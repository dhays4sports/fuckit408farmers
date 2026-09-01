#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import base64,mimetypes,json,sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)
def inline_page(rel):
    pp=ROOT/rel; soup=BeautifulSoup(pp.read_text(),'html.parser'); css=[]; scripts=[]
    for link in list(soup.find_all('link')):
        if getattr(link,'attrs',None) is None or 'stylesheet' not in (link.attrs.get('rel') or []): continue
        href=(link.attrs.get('href') or '').split('?')[0]
        p=(ROOT/href.lstrip('/')) if href.startswith('/') else (pp.parent/href).resolve()
        if p.exists(): css.append(p.read_text())
        link.decompose()
    for script in list(soup.find_all('script',src=True)):
        src=(script.get('src') or '').split('?')[0]
        p=(ROOT/src.lstrip('/')) if src.startswith('/') else (pp.parent/src).resolve()
        if p.exists() and src.endswith(('ui-3-foundation.js','editorial-platform.js')): scripts.append((src,p.read_text()))
        script.decompose()
    for img in soup.find_all('img'):
        src=img.get('src','') if getattr(img,'attrs',None) else ''
        if not src or src.startswith(('data:','http:','https:')): continue
        p=(ROOT/src.lstrip('/')) if src.startswith('/') else (pp.parent/src).resolve()
        if p.exists():
            mime=mimetypes.guess_type(str(p))[0] or 'application/octet-stream'
            img['src']=f'data:{mime};base64,'+base64.b64encode(p.read_bytes()).decode()
    for source in soup.find_all('source'):
        if getattr(source,'attrs',None): source.attrs.pop('srcset',None)
    st=soup.new_tag('style'); st.string='\n'.join(css); soup.head.append(st)
    scripts.sort(key=lambda x: 0 if 'ui-3-foundation' in x[0] else 1)
    return str(soup),scripts

def no_overflow(page,label):
    d=page.evaluate('()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
    check(label+' no horizontal overflow',max(d['sw'],d['bw'])<=d['w']+2,str(d))
def visible(page,sel,label):
    loc=page.locator(sel).first
    check(label,loc.count()>0 and loc.is_visible())
def target(page,sel,label,h=44):
    loc=page.locator(sel).first; box=loc.bounding_box() if loc.count() and loc.is_visible() else None
    check(label+' visible',box is not None)
    if box: check(label+f' >= {h}px',box['height']>=h-.5,str(box))

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for rel,key in [('home/index.html','home'),('auto-bundle/index.html','bundle')]:
        html,scripts=inline_page(rel)
        for w,h,vp in [(320,820,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1024,900,'laptop'),(1440,1000,'desktop')]:
            label=f'{key}-{vp}'
            page=browser.new_page(viewport={'width':w,'height':h}); page.set_content(html,wait_until='load')
            for _,js in scripts: page.add_script_tag(content=js)
            page.wait_for_timeout(100)
            check(label+' ui4 marker',page.locator('body.ui43-home-bundle[data-ui4-home-bundle="408-UI-4.3"]').count()==1)
            visible(page,'.ui43-hero',label+' hero')
            visible(page,'.ui43-hero-copy h1',label+' h1')
            visible(page,'.ui43-hero-media',label+' media')
            visible(page,'.ui43-hero-action #leadForm',label+' working form')
            visible(page,'.ui43-relationship-band',label+' relationship')
            visible(page,'.ui43-support-columns',label+' support columns')
            visible(page,'.ui43-trust-strip',label+' trust strip')
            no_overflow(page,label)
            target(page,'.home-primary-cta' if key=='home' else '.ui43-hero-action .primary-button',label+' primary action',44)
            target(page,'.ui43-relationship-band a[href^="tel:"]',label+' call action',44)
            if w>=1121:
                cols=page.locator('.ui43-hero').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
                check(label+' three-zone desktop',len(cols.split())==3,cols)
                support=page.locator('.ui43-support-columns').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
                check(label+' three support columns',len(support.split())==3,support)
                check(label+' direct header contact',page.locator('.ui4-header-contact').count()==1 and page.locator('.ui4-header-contact').is_visible())
            elif w<=860:
                cols=page.locator('.ui43-hero').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
                check(label+' single-column mobile hero',len(cols.split())==1,cols)
                support=page.locator('.ui43-support-columns').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
                check(label+' single support column',len(support.split())==1,support)
                check(label+' menu toggle',page.locator('.ui3-menu-toggle').count()==1 and page.locator('.ui3-menu-toggle').is_visible())
            # Form cannot be visually duplicated.
            check(label+' one lead form',page.locator('#leadForm').count()==1)
            # Hero media should retain useful height without taking the whole document.
            box=page.locator('.ui43-hero-media').bounding_box()
            check(label+' media substantial',box is not None and box['height']>=320,str(box))
            page.close()
    browser.close()
passed=sum(c['passed'] for c in checks)
out={'sprint':'408-UI-4.3','suite':'home_bundle_editorial_browser','total':len(checks),'passed':passed,'failed':len(checks)-passed,'checks':checks}
(ROOT/'UI4_3_BROWSER_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-4.3 Browser QA: {passed}/{len(checks)} passed')
sys.exit(0 if passed==len(checks) else 1)
