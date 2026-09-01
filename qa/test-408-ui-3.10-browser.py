#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json,sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,cond):
    checks.append({'name':name,'passed':bool(cond)})
    if not cond: print('FAIL',name)

def inline_page(rel):
    pp=ROOT/rel
    soup=BeautifulSoup(pp.read_text(errors='ignore'),'html.parser')
    css=[]
    for link in soup.find_all('link'):
        if 'stylesheet' not in (link.get('rel') or []): continue
        href=(link.get('href') or '').split('?')[0]
        if not href: continue
        p=(ROOT/href.lstrip('/')) if href.startswith('/') else (pp.parent/href).resolve()
        if p.exists(): css.append(p.read_text(errors='ignore'))
    for script in list(soup.find_all('script',src=True)): script.decompose()
    for img in soup.find_all('img'):
        img.attrs.pop('src',None);img.attrs.pop('srcset',None)
    st=soup.new_tag('style');st.string='\n'.join(css);soup.head.append(st)
    return str(soup)

def dims(page):
    return page.evaluate('()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
def no_overflow(page,label):
    d=dims(page);check(label,max(d['sw'],d['bw'])<=d['w']+2)
def height(page,sel):
    b=page.locator(sel).first.bounding_box();return b['height'] if b else 0
def visible(page,sel,label): check(label,page.locator(sel).first.is_visible())

def check_mobile_chrome(page,tag):
    visible(page,'.ui3-site-header',tag+' header visible')
    visible(page,'.ui3-menu-toggle',tag+' menu toggle visible')
    check(tag+' menu target >=44',height(page,'.ui3-menu-toggle')>=43.5)
    page.locator('.ui3-menu-toggle').click()
    nav=page.locator('.ui3-primary-nav')
    check(tag+' nav opens',nav.is_visible())
    nb=nav.bounding_box(); d=dims(page)
    check(tag+' nav fits viewport',bool(nb) and nb['height']<=d['h']-8)
    for i in range(min(nav.locator('a').count(),7)):
        b=nav.locator('a').nth(i).bounding_box()
        check(tag+f' nav link {i+1} >=44',bool(b) and b['height']>=43.5)
    page.keyboard.press('Escape')

ui3=(ROOT/'shared/ui-3-foundation.js').read_text()
# Representative consumer routes across every UI family.
cases=[
 ('index.html',None,'.ui321-situation-grid a'),
 ('home/index.html','#leadForm input[name="first_name"]','.home-primary-cta'),
 ('auto-bundle/index.html','#leadForm input[name="first_name"]','#leadForm .primary-button'),
 ('buyer/index.html','#leadForm input[name="first_name"]','.buyer-button--primary'),
 ('healthcare/index.html','#leadForm input[name="first_name"]','#leadForm .primary-button'),
 ('life/index.html',None,'.life-primary-cta'),
 ('local/join/index.html','#localMerchantJoinForm input[name="business_name"]','.local-join-submit'),
 ('contact/index.html',None,'.contact-method--primary'),
 ('home/thank-you.html',None,'.thanks-actions .primary')
]
viewports=[
 (320,568,'phone320-short'),(390,844,'phone390'),(768,1024,'tablet'),
 (844,390,'landscape844'),(667,375,'landscape667')
]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,hgt,vp in viewports:
      for rel,input_sel,action_sel in cases:
        tag=rel.replace('/','-')+'-'+vp
        page=browser.new_page(viewport={'width':w,'height':hgt},is_mobile=(w<900),has_touch=(w<900))
        page.set_content(inline_page(rel),wait_until='load')
        page.add_script_tag(content=ui3);page.wait_for_timeout(45)
        check(tag+' ui3 body',page.locator('body.ui3-page').count()==1)
        no_overflow(page,tag+' no horizontal overflow')
        if w<=860: check_mobile_chrome(page,tag)
        if action_sel and page.locator(action_sel).count():
            b=page.locator(action_sel).first.bounding_box()
            check(tag+' primary action visible',b is not None)
            if b: check(tag+' primary action >=44',b['height']>=43.5)
        if input_sel and page.locator(input_sel).count():
            el=page.locator(input_sel).first
            fs=float(el.evaluate('e=>parseFloat(getComputedStyle(e).fontSize)'))
            sm=float(el.evaluate('e=>parseFloat(getComputedStyle(e).scrollMarginTop)'))
            check(tag+' input 16px',fs>=15.9)
            check(tag+' input focus scroll margin',sm>=59)
            if el.is_visible(): check(tag+' visible input >=44',height(page,input_sel)>=43.5)
        # No mobile layer may hide consent/guardrail language on form routes.
        if rel in ('home/index.html','auto-bundle/index.html','buyer/index.html','healthcare/index.html','local/join/index.html'):
            consent=page.locator('.consent,.buyer-consent,.local-check-row').first
            if consent.count(): check(tag+' consent remains renderable',consent.evaluate('e=>getComputedStyle(e).display')!='none')
        page.close()

    # Narrow Professional switcher stays horizontally navigable and target-sized.
    page=browser.new_page(viewport={'width':320,'height':568},is_mobile=True,has_touch=True)
    page.set_content(inline_page('healthcare/index.html'));page.add_script_tag(content=ui3);page.wait_for_timeout(40)
    sw=page.locator('.professional-program-switcher')
    check('professional switcher visible',sw.is_visible())
    check('professional switcher x-scroll',sw.evaluate('e=>getComputedStyle(e).overflowX') in ('auto','scroll'))
    check('professional route target >=44',height(page,'.professional-program-switcher a')>=43.5)
    no_overflow(page,'professional narrow no page overflow')
    page.close()

    # Local filters remain touch-scrollable rather than creating page overflow.
    page=browser.new_page(viewport={'width':320,'height':568},is_mobile=True,has_touch=True)
    page.set_content(inline_page('local/index.html'));page.add_script_tag(content=ui3);page.wait_for_timeout(40)
    lf=page.locator('.local-filter-scroll')
    check('local filter scroller exists',lf.count()==1)
    if lf.count(): check('local filter scroller x-scroll',lf.evaluate('e=>getComputedStyle(e).overflowX') in ('auto','scroll'))
    no_overflow(page,'local narrow no page overflow')
    page.close()
    browser.close()
failed=[c for c in checks if not c['passed']]
result={'sprint':'408-UI-3.10','suite':'browser_mobile_interaction','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'viewports':[f'{w}x{h}' for w,h,_ in viewports],'routes':[x[0] for x in cases],'checks':checks}
(ROOT/'UI3_10_BROWSER_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.10 Browser QA: {result['passed']}/{result['total']} passed")
sys.exit(1 if failed else 0)
