#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from urllib.parse import urlparse
import json,sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,cond,detail=None):
    checks.append({'name':name,'passed':bool(cond),'detail':detail})
    if not cond: print('FAIL',name,detail or '')
def basename(u): return Path(urlparse(u).path).name
def fake_url(u): return 'https://asset.test/'+basename(u)
def fake_srcset(value):
    out=[]
    for cand in (value or '').split(','):
        bits=cand.strip().split()
        if not bits: continue
        bits[0]=fake_url(bits[0]); out.append(' '.join(bits))
    return ', '.join(out)
def minimal_media(rel,selector):
    soup=BeautifulSoup((ROOT/rel).read_text(errors='ignore'),'html.parser')
    img=soup.select_one(selector)
    if not img: return None,None
    pic=img.find_parent('picture')
    mini=BeautifulSoup('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body></body>','html.parser')
    if pic:
        np=mini.new_tag('picture')
        for src in pic.find_all('source',recursive=False):
            ns=mini.new_tag('source')
            if src.get('type'): ns['type']=src['type']
            if src.get('sizes'): ns['sizes']=src['sizes']
            if src.get('srcset'): ns['srcset']=fake_srcset(src['srcset'])
            np.append(ns)
        ni=mini.new_tag('img',id='hero')
        ni['src']=fake_url(img.get('src') or '')
        if img.get('srcset'): ni['srcset']=fake_srcset(img['srcset'])
        if img.get('sizes'): ni['sizes']=img['sizes']
        if img.get('fetchpriority'): ni['fetchpriority']=img['fetchpriority']
        np.append(ni); mini.body.append(np)
    else:
        ni=mini.new_tag('img',id='hero'); ni['src']=fake_url(img.get('src') or '')
        if img.get('srcset'): ni['srcset']=fake_srcset(img['srcset'])
        if img.get('sizes'): ni['sizes']=img['sizes']
        if img.get('fetchpriority'): ni['fetchpriority']=img['fetchpriority']
        mini.body.append(ni)
    return str(mini),img
cases=[
 ('index.html','img[alt="A well-maintained California home at dusk"]','home-420.webp'),
 ('home/index.html','img[alt="Modern California home at sunset"]','home-420.webp'),
 ('auto-bundle/index.html','img[alt^="Vehicle outside"]','auto-bundle-editorial-320.webp'),
 ('buyer/index.html','img[alt^="Illustrative homebuyers"]','buyer-editorial-context-420.webp'),
 ('healthcare/index.html','img[src*="ui45-professional-healthcare"]','ui45-professional-healthcare-320.webp'),
 ('teachers/index.html','img[src*="ui45-professional-teachers"]','ui45-professional-teachers-320.webp'),
 ('tech/index.html','img[src*="ui45-professional-tech"]','ui45-professional-tech-320.webp'),
 ('engineers/index.html','img[src*="ui45-professional-engineers"]','ui45-professional-engineers-320.webp'),
 ('local/index.html','img[src*="local-community-context"]','local-community-context-320.webp'),
 ('local/join/index.html','img[src*="local-community-context"]','local-community-context-320.webp'),
]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    page.route('https://asset.test/**', lambda route: route.abort())
    for rel,sel,want in cases:
        html,source_img=minimal_media(rel,sel)
        check(rel+' hero source exists',html is not None)
        if not html: continue
        page.set_content(html,wait_until='domcontentloaded')
        loc=page.locator('#hero')
        current=loc.evaluate('e=>e.currentSrc || e.src')
        check(rel+' browser mobile candidate',want in current,current)
        check(rel+' source high priority',(source_img.get('fetchpriority') or '')=='high',source_img.get('fetchpriority'))
    # Header identity candidate selection from the actual homepage attributes.
    html,source_img=minimal_media('index.html','img[src$="408-farmers-logo.png"]')
    page.set_content(html,wait_until='domcontentloaded')
    current=page.locator('#hero').evaluate('e=>e.currentSrc || e.src')
    check('homepage header responsive logo','408-farmers-logo-506.webp' in current,current)
    page.close(); b.close()
out={'sprint':'408-UI-4.9','suite':'responsive_asset_selection_browser','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'viewport':'390x844@1x','checks':checks}
(ROOT/'UI4_9_PERFORMANCE_BROWSER_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-4.9 Performance Browser QA: {out['passed']}/{out['total']} passed")
sys.exit(1 if out['failed'] else 0)
