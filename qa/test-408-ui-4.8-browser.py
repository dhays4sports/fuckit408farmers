#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import base64,json,mimetypes,sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,cond,detail=None):
    checks.append({'name':name,'passed':bool(cond),'detail':detail})
    if not cond: print('FAIL',name,detail or '')
def inline_page(rel):
    pp=ROOT/rel; soup=BeautifulSoup(pp.read_text(errors='ignore'),'html.parser'); css=[]
    for link in list(soup.find_all('link')):
        if 'stylesheet' not in (link.get('rel') or []): continue
        href=(link.get('href') or '').split('?')[0]
        if not href: continue
        fp=(ROOT/href.lstrip('/')) if href.startswith('/') else (pp.parent/href).resolve()
        if fp.exists(): css.append(fp.read_text(errors='ignore'))
    for script in list(soup.find_all('script',src=True)): script.decompose()
    for img in soup.find_all('img'):
        img.attrs.pop('srcset',None)
        img['src']=''
    for source in soup.find_all('source'): source.decompose()
    for c in css:
        st=soup.new_tag('style'); st.string=c; soup.head.append(st)
    return str(soup)
def no_overflow(page,label):
    d=page.evaluate('()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
    check(label+' no overflow',max(d['sw'],d['bw'])<=d['w']+2,str(d))
def target(page,sel,label,h=44):
    x=page.locator(sel).first; box=x.bounding_box() if x.count() and x.is_visible() else None
    check(label+' visible',box is not None)
    if box: check(label+' target',box['height']>=h-.5,str(box))

def font16(page,sel,label):
    x=page.locator(sel).first
    if x.count() and x.is_visible():
        s=float(x.evaluate('e=>parseFloat(getComputedStyle(e).fontSize)'))
        check(label+' 16px',s>=15.9,str(s))

routes=['index.html','home/index.html','auto-bundle/index.html','buyer/index.html','healthcare/index.html','teachers/index.html','tech/index.html','engineers/index.html','local/index.html','local/detail/index.html','local/join/index.html','home/thank-you.html','buyer/thank-you.html','contact/index.html','neighbor/index.html','score/index.html','404.html','privacy.html','terms.html']
viewports=[(320,820,'320'),(375,812,'375'),(390,844,'390'),(768,1024,'tablet'),(844,390,'short-landscape'),(1024,768,'tablet-landscape')]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    cache={r:inline_page(r) for r in routes}
    for w,h,vp in viewports:
        page=b.new_page(viewport={'width':w,'height':h})
        for rel in routes:
            page.set_content(cache[rel],wait_until='load')
            check(rel+' '+vp+' marker',page.locator('body.ui48-responsive').count()==1)
            no_overflow(page,rel+' '+vp)
        page.close()

    # Certified conversion controls: minimum target and mobile input sizing.
    cases=[
      ('home/index.html','#leadForm input:not([type=hidden])','.home-primary-cta'),
      ('auto-bundle/index.html','#leadForm input:not([type=hidden])','#leadForm .primary-button'),
      ('buyer/index.html','#leadForm input:not([type=hidden])','.buyer-next'),
      ('healthcare/index.html','#leadForm input:not([type=hidden])','#leadForm .primary-button'),
      ('local/join/index.html','#localJoinForm input:not([type=hidden])','.local-join-submit'),
    ]
    for rel,field,button in cases:
        page=b.new_page(viewport={'width':390,'height':844}); page.set_content(cache[rel])
        font16(page,field,rel+' field')
        target(page,button,rel+' primary')
        page.close()

    # Professional program family must scroll internally at 320 rather than widening document.
    page=b.new_page(viewport={'width':320,'height':820}); page.set_content(cache['healthcare/index.html'])
    sw=page.locator('.professional-program-switcher').evaluate('e=>({sw:e.scrollWidth,cw:e.clientWidth,ox:getComputedStyle(e).overflowX})')
    check('professional switcher internal scroll',sw['sw']>sw['cw'] and sw['ox'] in ('auto','scroll'),str(sw))
    no_overflow(page,'professional switcher document')
    page.close()

    # Phone image crops are intentionally compact; action panel remains in normal flow.
    hero_cases=[('index.html','.ui42-hero-media','.ui42-hero-action'),('home/index.html','.ui43-hero-media','.ui43-hero-action'),('buyer/index.html','.ui44-buyer-media','.ui44-buyer-action'),('healthcare/index.html','.ui45-professional-media','.ui45-professional-action'),('local/index.html','.ui46-local-hero__media','.ui46-local-hero__action')]
    for rel,media,action in hero_cases:
        page=b.new_page(viewport={'width':390,'height':844}); page.set_content(cache[rel])
        mb=page.locator(media).first.bounding_box(); ab=page.locator(action).first.bounding_box()
        check(rel+' compact phone media',mb is not None and mb['height']<=310,str(mb))
        check(rel+' action visible',ab is not None and ab['width']<=390,str(ab))
        page.close()

    # Relationship band collapses to one track by phone width.
    page=b.new_page(viewport={'width':390,'height':844}); page.set_content(cache['home/index.html'])
    cols=page.locator('.ui43-relationship-band').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
    check('relationship band single column phone',len(cols.split())==1,cols)
    page.close()

    # Score fixed CTA gets reserved body space beyond the bar height.
    page=b.new_page(viewport={'width':390,'height':844}); page.set_content(cache['score/index.html'])
    pad=float(page.locator('body').evaluate('e=>parseFloat(getComputedStyle(e).paddingBottom)||0'))
    check('score bottom reserve',pad>=90,str(pad))
    page.close()
    b.close()

out={'sprint':'408-UI-4.8','suite':'mobile_responsive_editorial_browser','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'viewports':['320x820','375x812','390x844','768x1024','844x390','1024x768'],'routes':routes,'checks':checks}
(ROOT/'UI4_8_BROWSER_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-4.8 Browser QA: {out['passed']}/{out['total']} passed")
sys.exit(1 if out['failed'] else 0)
