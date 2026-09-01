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

def inline_page():
    pp=ROOT/'index.html'; soup=BeautifulSoup(pp.read_text(),'html.parser'); css=[]; scripts=[]
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
def min_target(page,sel,label,h=44):
    loc=page.locator(sel).first; box=loc.bounding_box() if loc.count() else None
    check(label+' visible',box is not None)
    if box: check(label+f' >= {h}px',box['height']>=h-.5,str(box))

html,scripts=inline_page()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,h,label in [(320,800,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1024,900,'laptop'),(1440,900,'desktop')]:
        page=browser.new_page(viewport={'width':w,'height':h}); page.set_content(html,wait_until='load')
        for _,js in scripts: page.add_script_tag(content=js)
        page.wait_for_timeout(80)
        check(label+' ui3',page.locator('body.ui3-page').count()==1)
        check(label+' ui4',page.locator('body.ui4-page').count()==1)
        check(label+' homepage marker',page.locator('body[data-ui4-homepage="408-UI-4.2"]').count()==1)
        check(label+' hero h1',page.get_by_role('heading',name='Insurance That Fits.').is_visible())
        check(label+' not quote',page.get_by_text('Not a quote.',exact=False).first.is_visible())
        check(label+' contextual media',page.locator('.ui42-hero-media').is_visible())
        check(label+' action panel',page.locator('.ui42-situation-panel').is_visible())
        check(label+' right routes three',page.locator('.ui42-quick-routes a').count()==3)
        check(label+' relationship band',page.locator('.ui42-relationship-band').is_visible())
        check(label+' full six situations',page.locator('.ui321-situation-grid a').count()==6)
        check(label+' four secondary products',page.locator('.ui321-secondary-products .ui32-product-card').count()==4)
        check(label+' CoverageFit',page.locator('#coveragefit').is_visible())
        check(label+' Local',page.locator('.ui42-local-card').count()==1)
        check(label+' agent',page.locator('.ui42-agent-grid').count()==1)
        no_overflow(page,label)
        min_target(page,'.ui32-hero-actions .cf-button--primary',label+' hero CTA',44)
        min_target(page,'.ui42-quick-routes a',label+' hero situation',44)
        min_target(page,'.ui321-situation-grid a',label+' full situation',44)
        if w>=1121:
            cols=page.locator('.ui42-hero-shell').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' three zone desktop',len(cols.split())==3,cols)
            check(label+' header direct contact',page.locator('.ui4-header-contact').is_visible())
        elif w<=860:
            cols=page.locator('.ui42-hero-shell').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' single column editorial hero',len(cols.split())==1,cols)
            check(label+' mobile menu toggle',page.locator('.ui3-menu-toggle').is_visible())
            page.locator('.ui3-menu-toggle').click(); check(label+' menu opens',page.locator('.ui3-menu-toggle').get_attribute('aria-expanded')=='true')
            page.keyboard.press('Escape'); check(label+' menu closes',page.locator('.ui3-menu-toggle').get_attribute('aria-expanded')=='false')
        if w<=620:
            cols=page.locator('.ui321-situation-grid').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' one column full chooser',len(cols.split())==1,cols)
        elif w<=900:
            cols=page.locator('.ui321-situation-grid').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' two column full chooser',len(cols.split())==2,cols)
        else:
            cols=page.locator('.ui321-situation-grid').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' three column full chooser',len(cols.split())==3,cols)
        # Headline words may wrap by phrase/line, but must never split a single word.
        split=page.locator('#hub-title').evaluate("e=>{const r=document.createRange();let out=[];for(const n of e.childNodes){if(n.nodeType===3){const words=n.textContent.trim().split(/\\s+/).filter(Boolean); for(const w of words){const i=n.textContent.indexOf(w); const rr=document.createRange(); rr.setStart(n,i);rr.setEnd(n,i+w.length); const rects=[...rr.getClientRects()]; out.push([w,rects.length]);}}}return out}")
        check(label+' no headline word fragmentation',all(n<=1 for _,n in split),str(split))
        page.close()
    browser.close()
passed=sum(c['passed'] for c in checks)
out={'sprint':'408-UI-4.2','suite':'homepage_editorial_browser','total':len(checks),'passed':passed,'failed':len(checks)-passed,'checks':checks}
(ROOT/'UI4_2_BROWSER_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-4.2 Browser QA: {passed}/{len(checks)} passed')
sys.exit(0 if passed==len(checks) else 1)
