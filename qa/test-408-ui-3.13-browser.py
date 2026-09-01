#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import base64,json,sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,cond,detail=''):
    checks.append({'name':name,'passed':bool(cond),'detail':'' if cond else str(detail)})
    if not cond: print('FAIL',name,detail)
def inline_page(rel):
    pp=ROOT/rel;soup=BeautifulSoup(pp.read_text(errors='ignore'),'html.parser');css=[]
    for link in soup.find_all('link'):
        if 'stylesheet' not in (link.get('rel') or []): continue
        href=(link.get('href') or '').split('?')[0]
        q=(ROOT/href.lstrip('/')) if href.startswith('/') else (pp.parent/href).resolve()
        if q.exists(): css.append(q.read_text(errors='ignore'))
    for sc in list(soup.find_all('script',src=True)): sc.decompose()
    # Isolated rendering does not need external/local image fetches; certified frames remain in CSS.
    for source in soup.find_all('source'):
        source.attrs.pop('srcset',None); source.attrs.pop('src',None)
    for img in soup.find_all('img'):
        img.attrs.pop('src',None);img.attrs.pop('srcset',None)
    st=soup.new_tag('style');st.string='\n'.join(css);soup.head.append(st)
    return str(soup)
def add_script(page,rel): page.add_script_tag(content=(ROOT/rel).read_text(errors='ignore'))
def dims(page): return page.evaluate('()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
def visible(page,sel):
    loc=page.locator(sel).first
    return loc.count()==1 and loc.is_visible()
def box(page,sel):
    loc=page.locator(sel).first
    return loc.bounding_box() if loc.count() else None

def mount(page,rel):
    page.set_content(inline_page(rel),wait_until='load')
    # The final shared UI/accessibility scripts are the only presentation scripts needed for shell certification.
    add_script(page,'shared/ui-3-foundation.js')
    add_script(page,'shared/accessibility-certification.js')
    page.wait_for_timeout(35)

primary=[
 'index.html','home/index.html','auto-bundle/index.html','buyer/index.html','healthcare/index.html','teachers/index.html','tech/index.html','engineers/index.html','life/index.html','local/index.html','local/join/index.html','contact/index.html','score/index.html','privacy.html','terms.html'
]
receipts=['home/thank-you.html','auto-bundle/thank-you.html','buyer/thank-you.html','healthcare/thank-you.html','teachers/thank-you.html','tech/thank-you.html','engineers/thank-you.html','life/thank-you.html','local/join/thank-you.html','404.html','neighbor/index.html']
viewports=[(320,568,'phone320'),(390,844,'phone390'),(768,1024,'tablet768'),(1024,768,'desktop1024'),(1440,900,'desktop1440')]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,h,label in viewports:
        for rel in primary:
            tag=rel.replace('/','-')+'-'+label
            page=browser.new_page(viewport={'width':w,'height':h},is_mobile=w<900,has_touch=w<900,reduced_motion='reduce')
            errors=[];page.on('pageerror',lambda e,errs=errors:errs.append(str(e)))
            mount(page,rel)
            d=dims(page)
            check(tag+' no page errors',not errors,errors[:3])
            check(tag+' no horizontal overflow',max(d['sw'],d['bw'])<=d['w']+2,d)
            check(tag+' main visible',visible(page,'main'))
            check(tag+' h1 visible',visible(page,'h1'))
            hb=box(page,'h1')
            check(tag+' h1 inside viewport',bool(hb) and hb['x']>=-2 and hb['x']+hb['width']<=w+3,hb)
            bodyfs=float(page.locator('body').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)'))
            check(tag+' body font readable',bodyfs>=15.5,bodyfs)
            # Universal shell should be enhanced on public UI-3 pages except the intentionally minimal bridge.
            if rel!='neighbor/index.html':
                check(tag+' ui3 body',page.locator('body.ui3-page').count()==1)
            if w<=860 and page.locator('.ui3-menu-toggle').count():
                mb=box(page,'.ui3-menu-toggle'); check(tag+' menu target >=44',bool(mb) and mb['width']>=43.5 and mb['height']>=43.5,mb)
                page.locator('.ui3-menu-toggle').click();page.wait_for_timeout(10)
                check(tag+' mobile nav opens',page.locator('.ui3-primary-nav').is_visible())
                page.keyboard.press('Escape')
            # Primary conversion controls must remain touch-sized when present.
            for sel in ['.cf-button--primary','.home-primary-cta','.primary-button','.buyer-button--primary','.life-primary-cta','.local-join-submit']:
                if page.locator(sel).count() and page.locator(sel).first.is_visible():
                    b=box(page,sel);check(tag+' primary target '+sel,bool(b) and b['height']>=43.5,b);break
            page.close()
    # Utility/receipt edge cases at narrow + wide widths.
    for w,h,label in [(320,568,'receipt-phone'),(1440,900,'receipt-desktop')]:
        for rel in receipts:
            tag=rel.replace('/','-')+'-'+label
            page=browser.new_page(viewport={'width':w,'height':h},is_mobile=w<900,has_touch=w<900,reduced_motion='reduce')
            errors=[];page.on('pageerror',lambda e,errs=errors:errs.append(str(e)))
            mount(page,rel);d=dims(page)
            check(tag+' no page errors',not errors,errors[:3])
            check(tag+' no horizontal overflow',max(d['sw'],d['bw'])<=d['w']+2,d)
            check(tag+' h1 visible',visible(page,'h1'))
            page.close()
    # UI-3.13 responsive picture wrappers preserve the certified frame geometry.
    for rel,frame in [('index.html','.ui32-hero-image-wrap'),('buyer/index.html','.buyer-visual'),('life/index.html','.life-campaign-visual')]:
        for w,h,label in [(390,844,'media-mobile'),(1440,900,'media-desktop')]:
            page=browser.new_page(viewport={'width':w,'height':h},is_mobile=w<900,has_touch=w<900)
            mount(page,rel)
            pic=page.locator(frame+' picture').first
            fb=box(page,frame);pb=pic.bounding_box() if pic.count() else None
            check(rel+' '+label+' picture present',pic.count()==1)
            check(rel+' '+label+' frame nonzero',bool(fb) and fb['width']>100 and fb['height']>150,fb)
            check(rel+' '+label+' picture fills frame',bool(fb and pb) and pb['width']>=fb['width']-2 and pb['height']>=fb['height']-2,(fb,pb))
            page.close()
    browser.close()
failed=[c for c in checks if not c['passed']]
out={'sprint':'408-UI-3.13','suite':'production_browser_design','engine':'Chromium','viewports':[f'{w}x{h}' for w,h,_ in viewports],'primary_routes':primary,'utility_routes':receipts,'total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(ROOT/'UI3_13_BROWSER_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-3.13 Browser QA: {out['passed']}/{out['total']} passed")
sys.exit(1 if failed else 0)
