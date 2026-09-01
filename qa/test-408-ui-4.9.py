#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import hashlib,json,math,re,sys
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'UI4_9_INPUT_BASELINE.json').read_text())
checks=[]
def check(name,cond,detail=None):
    checks.append({'name':name,'passed':bool(cond),'detail':detail})
    if not cond: print('FAIL',name,detail or '')
def sha(p): return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def read(p): return (ROOT/p).read_text(errors='ignore')
PAGES=['404.html','auto-bundle/index.html','auto-bundle/thank-you.html','buyer/index.html','buyer/thank-you.html','contact/index.html','engineers/index.html','engineers/thank-you.html','healthcare/index.html','healthcare/thank-you.html','home/index.html','home/thank-you.html','index.html','local/detail/index.html','local/index.html','local/join/index.html','local/join/thank-you.html','neighbor/index.html','privacy.html','score/index.html','teachers/index.html','teachers/thank-you.html','tech/index.html','tech/thank-you.html','terms.html']
PRIMARY=['index.html','home/index.html','auto-bundle/index.html','buyer/index.html','healthcare/index.html','teachers/index.html','tech/index.html','engineers/index.html','local/index.html','local/join/index.html']

# New layer contract
cssp=ROOT/'shared/accessibility-performance.css'; check('4.9 css exists',cssp.exists())
css=read('shared/accessibility-performance.css')
for token in ['408-UI-4.9 — Accessibility + Performance Certification','focus-visible','--ui49-gold-text:#8e5f00','prefers-reduced-motion:reduce','forced-colors:active','max-width:360px','scroll-margin-top','overflow-wrap:break-word']:
    check('css token '+token,token in css)

# Contrast math for the certified gold policy.
def srgb(c):
    c=c/255
    return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def lum(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16) for i in (0,2,4)]
    return .2126*srgb(r)+.7152*srgb(g)+.0722*srgb(b)
def contrast(a,b):
    x,y=lum(a),lum(b); return (max(x,y)+.05)/(min(x,y)+.05)
check('small gold text AA on white',contrast('#8e5f00','#ffffff')>=4.5,f"{contrast('#8e5f00','#ffffff'):.2f}:1")
check('large editorial gold AA-large on white',contrast('#a86f00','#ffffff')>=3.0,f"{contrast('#a86f00','#ffffff'):.2f}:1")
check('header gold on navy AA',contrast('#ffd37b','#031a3d')>=4.5,f"{contrast('#ffd37b','#031a3d'):.2f}:1")

# Structural accessibility, image policy and marker coverage.
for rel in PAGES:
    soup=BeautifulSoup(read(rel),'html.parser')
    check(rel+' 4.9 stylesheet',soup.find('link',href='/shared/accessibility-performance.css?v=408-UI-4.9') is not None)
    check(rel+' 4.9 meta',soup.find('meta',attrs={'name':'408farmers-ui-accessibility-performance','content':'408-UI-4.9'}) is not None)
    check(rel+' 4.9 body class','ui49-accessibility-performance' in (soup.body.get('class') or []))
    check(rel+' 4.9 body data',soup.body.get('data-ui4-accessibility-performance')=='408-UI-4.9')
    h=soup.find_all(['h1','h2','h3','h4','h5','h6']); levels=[int(x.name[1]) for x in h]
    check(rel+' exactly one h1',sum(1 for x in h if x.name=='h1')==1,str(levels))
    check(rel+' no heading jumps',not any(b>a+1 for a,b in zip(levels,levels[1:])),str(levels))
    skip=soup.select_one('a.skip-link'); href=skip.get('href') if skip else ''
    target=soup.select_one(href) if href and href.startswith('#') else None
    check(rel+' skip target',skip is not None and target is not None,href)
    imgs=soup.find_all('img')
    check(rel+' all images alt',all(i.has_attr('alt') for i in imgs))
    check(rel+' all images intrinsic size',all(i.get('width') and i.get('height') for i in imgs),str([i.get('src') for i in imgs if not(i.get('width') and i.get('height'))]))
    highs=[i for i in imgs if (i.get('fetchpriority') or '').lower()=='high']
    check(rel+' at most one high priority image',len(highs)<=1,str([i.get('src') for i in highs]))
    # Every visible interactive form control has an accessible name.
    bad=[]
    for el in soup.find_all(['input','select','textarea','button']):
        if el.name=='input' and el.get('type')=='hidden': continue
        if el.name=='button' and el.get_text(' ',strip=True): continue
        eid=el.get('id'); lab=soup.find('label',attrs={'for':eid}) if eid else None
        if not (lab or el.find_parent('label') or el.get('aria-label') or el.get('aria-labelledby') or el.get('title')): bad.append(str(el)[:120])
    check(rel+' controls named',not bad,str(bad))

# Responsive hero source sets and fetch-priority discipline.
expect={
 'index.html':('home-420.webp','home-653.webp'),
 'home/index.html':('home-420.webp','home-653.webp'),
 'auto-bundle/index.html':('auto-bundle-editorial-320.webp','auto-bundle-editorial.webp'),
 'buyer/index.html':('buyer-editorial-context-420.webp','buyer-editorial-context.webp'),
 'healthcare/index.html':('ui45-professional-healthcare-320.webp','ui45-professional-healthcare.webp'),
 'teachers/index.html':('ui45-professional-teachers-320.webp','ui45-professional-teachers.webp'),
 'tech/index.html':('ui45-professional-tech-320.webp','ui45-professional-tech.webp'),
 'engineers/index.html':('ui45-professional-engineers-320.webp','ui45-professional-engineers.webp'),
 'local/index.html':('local-community-context-320.webp','local-community-context.webp'),
 'local/join/index.html':('local-community-context-320.webp','local-community-context.webp'),
}
for rel,(small,large) in expect.items():
    soup=BeautifulSoup(read(rel),'html.parser')
    candidates=' '.join([(x.get('srcset') or '') for x in soup.find_all(['source','img'])])
    check(rel+' responsive hero small',small in candidates,candidates[:500])
    check(rel+' responsive hero large',large in candidates,candidates[:500])
    highs=[i for i in soup.find_all('img') if (i.get('fetchpriority') or '').lower()=='high']
    check(rel+' exactly one hero high',len(highs)==1,str([i.get('src') for i in highs]))
    if highs: check(rel+' high hero not lazy',(highs[0].get('loading') or '').lower()!='lazy',str(highs[0]))

# Encoded mobile editorial image ceilings retain/improve the UI-3.13 era budget discipline.
mobile_assets={
 'shared/assets/home-420.webp':55_000,
 'shared/assets/auto-bundle-editorial-320.webp':55_000,
 'shared/assets/buyer-editorial-context-420.webp':55_000,
 'shared/images/ui45-professional-healthcare-320.webp':40_000,
 'shared/images/ui45-professional-teachers-320.webp':50_000,
 'shared/images/ui45-professional-tech-320.webp':40_000,
 'shared/images/ui45-professional-engineers-320.webp':45_000,
 'shared/images/local-community-context-320.webp':40_000,
}
for rel,limit in mobile_assets.items():
    fp=ROOT/rel
    size=fp.stat().st_size if fp.exists() else 10**9
    check(rel+' mobile budget',size<=limit,f'{size} <= {limit}')
    try:
        with Image.open(fp) as im:
            im.verify()
        check(rel+' decodes',True)
    except Exception as exc:
        check(rel+' decodes',False,str(exc))

# Primary route uncompressed CSS+JS source budget. UI-3.13 was 300 KiB. Home has a documented
# 330 KiB grandfathered ceiling because subsequent protected HOME/FLOW/UI layers are additive;
# 4.9 adds CSS only and must keep every other primary route within the original 300 KiB ceiling.
def local_asset(page, url):
    url=url.split('?')[0]
    if not url or url.startswith(('http://','https://','//')): return None
    return (ROOT/url.lstrip('/')) if url.startswith('/') else (page.parent/url).resolve()
for rel in PRIMARY:
    p=ROOT/rel; soup=BeautifulSoup(p.read_text(errors='ignore'),'html.parser'); total=0
    for link in soup.find_all('link'):
        if 'stylesheet' not in (link.get('rel') or []): continue
        fp=local_asset(p,link.get('href') or '')
        if fp and fp.exists(): total+=fp.stat().st_size
    for script in soup.find_all('script',src=True):
        fp=local_asset(p,script.get('src') or '')
        if fp and fp.exists(): total+=fp.stat().st_size
    limit=330*1024 if rel=='home/index.html' else 300*1024
    check(rel+' css+js source budget',total<=limit,f'{total} <= {limit}')

# Existing performance budget contract and protected behavior remain exact.
check('performance-budgets exact',sha('performance-budgets.json')==BASE['performance_budgets_sha256'])
for rel,want in BASE['forms'].items():
    soup=BeautifulSoup(read(rel),'html.parser'); form=soup.find('form')
    got=hashlib.sha256(str(form).encode()).hexdigest() if form else None
    check(rel+' protected form exact',got==want)
for rel,want in BASE['protected_files'].items(): check(rel+' protected exact',sha(rel)==want)
for rel,want in BASE['life_files'].items(): check(rel+' life exact',sha(rel)==want)
for rel in ['life/index.html','life/thank-you.html','life-ops/index.html']:
    t=read(rel); check(rel+' 4.9 excluded','accessibility-performance.css' not in t and 'ui49-accessibility-performance' not in t)

out={'sprint':'408-UI-4.9','suite':'accessibility_performance_source_contract','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks}
(ROOT/'UI4_9_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-4.9 QA: {out['passed']}/{out['total']} passed")
sys.exit(1 if out['failed'] else 0)
