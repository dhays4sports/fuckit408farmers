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
    page_path=ROOT/rel
    soup=BeautifulSoup(page_path.read_text(),'html.parser')
    css=[]
    for link in list(soup.find_all('link')):
        rels=link.get('rel') or []
        if 'stylesheet' not in rels: continue
        href=(link.get('href') or '').split('?')[0]
        if href:
            p=(ROOT/href.lstrip('/')) if href.startswith('/') else (page_path.parent/href).resolve()
            if p.exists(): css.append(p.read_text())
        link.decompose()
    for script in list(soup.find_all('script',src=True)): script.decompose()
    style=soup.new_tag('style');style.string='\n'.join(css);soup.head.append(style)
    return str(soup)

def no_overflow(page,label):
    d=page.evaluate('()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
    check(label,max(d['sw'],d['bw'])<=d['w']+2)

def target(page,sel,label,minh=44):
    box=page.locator(sel).first.bounding_box();check(label+' visible',box is not None)
    if box: check(label+f' >= {minh}px',box['height']>=minh-.5)

routes={
 'healthcare':('Healthcare','Work in Healthcare?'),
 'teachers':('Teachers','Work in Education?'),
 'tech':('Technology','Work in Tech?'),
 'engineers':('Engineers','Are You an Engineer?')
}
ui3=(ROOT/'shared/ui-3-foundation.js').read_text()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for key,(label,hero) in routes.items():
      html=inline_page(f'{key}/index.html')
      for w,h,vp in [(320,800,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1440,900,'desktop')]:
        tag=f'{key}-{vp}'
        page=browser.new_page(viewport={'width':w,'height':h})
        page.set_content(html,wait_until='load')
        page.add_script_tag(content=ui3)
        page.wait_for_timeout(60)
        check(tag+' UI3 body',page.locator('body.ui3-page').count()==1)
        check(tag+' UI36 body hook',page.locator('body[data-ui-professional="408-UI-3.6"]').count()==1)
        check(tag+' universal header',page.locator('.ui3-site-header').count()==1)
        check(tag+' universal footer',page.locator('.ui3-site-footer').count()==1)
        check(tag+' family bar visible',page.locator('.professional-program-bar').is_visible())
        check(tag+' four family routes',page.locator('.professional-program-switcher a').count()==4)
        active=page.locator('.professional-program-switcher a[aria-current="page"]')
        check(tag+' one active family route',active.count()==1 and active.inner_text().strip()==label)
        check(tag+' h1 visible',page.get_by_role('heading',name=hero).is_visible())
        check(tag+' form card visible',page.locator('.quote-card').is_visible())
        check(tag+' lead form visible',page.locator('#leadForm').is_visible())
        check(tag+' role select visible',page.locator('#leadForm select[name="occupation_segment"]').is_visible())
        check(tag+' three review steps',page.locator('.steps article').count()==3)
        check(tag+' producer module visible',page.locator('.agent-section').is_visible())
        no_overflow(page,tag+' no horizontal overflow')
        target(page,'.professional-program-switcher a',tag+' family switcher target',44)
        target(page,'#leadForm .primary-button',tag+' primary submit',50)
        target(page,'#leadForm input[name="first_name"]',tag+' form input',48)
        red=page.locator('#leadForm .primary-button').evaluate('e=>getComputedStyle(e).backgroundColor')
        check(tag+' red primary',red in ('rgb(215, 25, 32)','rgba(215, 25, 32, 1)'))
        radius=float(page.locator('.quote-card').evaluate('e=>parseFloat(getComputedStyle(e).borderRadius)'))
        check(tag+' restrained card radius',10<=radius<=22.5)
        page.locator('#leadForm input[name="first_name"]').focus()
        ring=page.locator('#leadForm input[name="first_name"]').evaluate('e=>getComputedStyle(e).boxShadow')
        check(tag+' visible focus ring',ring not in ('none',''))
        cols=page.locator('.occupational-hero').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
        if w>=981: check(tag+' split hero',len(cols.split())==2)
        else: check(tag+' stacked hero',len(cols.split())==1)
        if w<=700:
            fg=page.locator('#leadForm .field-grid').first.evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(tag+' one-column field grid',len(fg.split())==1)
            fs=float(page.locator('#leadForm input[name="first_name"]').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)'))
            check(tag+' 16px mobile input',fs>=16)
        if w<=860:
            check(tag+' mobile menu toggle visible',page.locator('.ui3-menu-toggle').is_visible())
            page.locator('.ui3-menu-toggle').click()
            check(tag+' menu opens',page.locator('.ui3-menu-toggle').get_attribute('aria-expanded')=='true')
            page.keyboard.press('Escape')
            check(tag+' Escape closes menu',page.locator('.ui3-menu-toggle').get_attribute('aria-expanded')=='false')
        no_overflow(page,tag+' final no overflow')
        page.close()
    browser.close()

failed=[c for c in checks if not c['passed']]
result={'sprint':'408-UI-3.6','suite':'browser_rendering','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'routes':list(routes),'viewports':['320x800','390x844','768x1024','1440x900'],'checks':checks}
(ROOT/'UI3_6_BROWSER_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.6 Browser QA: {result['passed']}/{result['total']} passed")
sys.exit(1 if failed else 0)
