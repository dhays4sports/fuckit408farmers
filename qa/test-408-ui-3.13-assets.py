#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from PIL import Image
import json,re,sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,cond,detail=''):
    checks.append({'name':name,'passed':bool(cond),'detail':'' if cond else str(detail)})
    if not cond: print('FAIL',name,detail)

def resolve(base,href):
    href=href.split('#')[0].split('?')[0]
    if not href or href.startswith(('http://','https://','mailto:','tel:','sms:','data:','javascript:')): return None
    return ROOT/href.lstrip('/') if href.startswith('/') else (base.parent/href).resolve()

public_html=[p for p in ROOT.rglob('*.html') if 'qa/fixtures' not in p.as_posix() and '/qa/' not in p.as_posix()]
missing=[]
for p in public_html:
    s=BeautifulSoup(p.read_text(errors='ignore'),'html.parser')
    refs=[]
    for tag,attr in [('link','href'),('script','src'),('img','src'),('source','src'),('a','href')]:
        for el in s.find_all(tag):
            v=el.get(attr)
            if v: refs.append(v)
    for el in s.find_all(['source','img']):
        ss=el.get('srcset')
        if ss:
            for item in ss.split(','): refs.append(item.strip().split()[0])
    for ref in refs:
        q=resolve(p,ref)
        if q is not None and not q.exists(): missing.append((p.relative_to(ROOT).as_posix(),ref,q.as_posix()))
check('all public HTML local asset refs resolve',not missing,missing[:20])

# CSS url() references resolve.
css_missing=[]
for p in (ROOT/'shared').glob('*.css'):
    txt=p.read_text(errors='ignore')
    for ref in re.findall(r'url\(([^)]+)\)',txt):
        ref=ref.strip(' "\'')
        q=resolve(p,ref)
        if q is not None and not q.exists(): css_missing.append((p.name,ref,q.as_posix()))
check('shared CSS url refs resolve',not css_missing,css_missing[:20])

# Production hero image candidates and encoded byte ceilings.
hero_candidates={
 'homepage mobile':'shared/assets/home-420.webp',
 'homepage desktop':'shared/assets/home-653.webp',
 'home mobile':'shared/assets/home-420.webp',
 'home desktop':'shared/assets/home-653.webp',
 'bundle mobile':'shared/assets/auto-bundle-480.webp',
 'bundle desktop':'shared/assets/auto-bundle-800.webp',
 'buyer mobile':'shared/assets/buyer-home-420.webp',
 'buyer desktop':'shared/assets/buyer-home-595.webp',
 'healthcare mobile':'shared/assets/healthcare-480.webp',
 'healthcare desktop':'shared/assets/healthcare-800.webp',
 'teachers mobile':'shared/assets/teachers-480.webp',
 'teachers desktop':'shared/assets/teachers-800.webp',
 'tech mobile':'shared/assets/tech-480.webp',
 'tech desktop':'shared/assets/tech-800.webp',
 'engineers mobile':'shared/assets/engineers-480.webp',
 'engineers desktop':'shared/assets/engineers-800.webp',
 'life mobile':'shared/assets/life-family-campaign-420.webp',
 'life desktop':'shared/assets/life-family-campaign-705.webp',
}
for name,rel in hero_candidates.items():
    p=ROOT/rel
    check(name+' exists',p.is_file(),rel)
    if p.is_file():
        ceiling=125*1024 if 'mobile' in name else 155*1024
        check(name+' encoded budget',p.stat().st_size<=ceiling,f'{p.stat().st_size/1024:.1f} KiB > {ceiling/1024:.0f} KiB')
        try:
            im=Image.open(p); check(name+' decodes',im.width>0 and im.height>0,im.size)
        except Exception as e: check(name+' decodes',False,e)

# Ensure the three previously unoptimized lead visuals actually use responsive WebP markup.
for rel,needle in [
 ('index.html','home-653.webp'),('buyer/index.html','buyer-home-595.webp'),('life/index.html','life-family-campaign-705.webp')
]:
    txt=(ROOT/rel).read_text(errors='ignore')
    check(rel+' responsive WebP source',needle in txt and '<picture' in txt)

# Existing image budget contract still passes for campaign artwork.
bud=json.loads((ROOT/'performance-budgets.json').read_text())
asset_map={
 'auto-bundle':'auto-bundle','healthcare':'healthcare','teachers':'teachers','tech':'tech','engineers':'engineers'
}
for route,b in bud['routes'].items():
    base=b['asset']
    for suffix,key in [('480','mobile480MaxBytes'),('800','desktop800MaxBytes')]:
        p=ROOT/f'shared/assets/{base}-{suffix}.webp'
        check(route+' '+suffix+' budget',p.is_file() and p.stat().st_size<=b[key],f'{p.stat().st_size if p.exists() else "missing"} > {b[key]}')
    p=ROOT/f'shared/assets/{base}.webp'
    check(route+' full budget',p.is_file() and p.stat().st_size<=b['fullMaxBytes'],f'{p.stat().st_size if p.exists() else "missing"} > {b["fullMaxBytes"]}')

# CSS+JS encoded source ceiling per primary route. This is intentionally conservative and independent of compression.
route_pages=['index.html','home/index.html','auto-bundle/index.html','buyer/index.html','healthcare/index.html','teachers/index.html','tech/index.html','engineers/index.html','life/index.html','local/index.html','local/join/index.html','contact/index.html','score/index.html']
route_sizes={}
for rel in route_pages:
    p=ROOT/rel;s=BeautifulSoup(p.read_text(errors='ignore'),'html.parser'); total=0; parts=[]
    for link in s.find_all('link',href=True):
        if 'stylesheet' not in (link.get('rel') or []): continue
        q=resolve(p,link['href'])
        if q and q.exists(): total+=q.stat().st_size; parts.append(q.relative_to(ROOT).as_posix())
    for sc in s.find_all('script',src=True):
        q=resolve(p,sc['src'])
        if q and q.exists(): total+=q.stat().st_size; parts.append(q.relative_to(ROOT).as_posix())
    route_sizes[rel]={'encoded_css_js_bytes':total,'files':parts}
    check(rel+' CSS+JS encoded source budget',total<=300*1024,f'{total/1024:.1f} KiB')

# Key brand assets decode and remain reasonably sized for production.
for rel,max_kb in [('shared/assets/408-farmers-nav-logo.png',80),('shared/assets/408-farmers-logo-506.webp',30),('shared/images/dylan-headshot-320.webp',15),('shared/assets/farmers-authorized-agency-320.webp',15)]:
    p=ROOT/rel
    check(rel+' exists',p.is_file())
    if p.is_file():
        check(rel+' size budget',p.stat().st_size<=max_kb*1024,f'{p.stat().st_size/1024:.1f} KiB')
        try: im=Image.open(p); check(rel+' decodes',im.width>0 and im.height>0,im.size)
        except Exception as e: check(rel+' decodes',False,e)

failed=[c for c in checks if not c['passed']]
out={'sprint':'408-UI-3.13','suite':'asset_and_performance_budget','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'route_sizes':route_sizes,'checks':checks}
(ROOT/'UI3_13_ASSET_PERFORMANCE_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-3.13 Asset/Performance QA: {out['passed']}/{out['total']} passed")
sys.exit(1 if failed else 0)
