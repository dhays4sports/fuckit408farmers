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

def inline_bundle():
    soup=BeautifulSoup((ROOT/'auto-bundle/index.html').read_text(),'html.parser')
    css=[]
    links=[]
    for link in soup.find_all('link'):
        rel=link.get('rel') or []
        if 'stylesheet' in rel:
            links.append((link,(link.get('href') or '').split('?')[0]))
    for link,href in links:
        if href:
            p=ROOT/(href.lstrip('/') if href.startswith('/') else 'auto-bundle/'+href)
            if not p.exists(): p=(ROOT/'auto-bundle'/href).resolve()
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

html=inline_bundle(); ui3=(ROOT/'shared/ui-3-foundation.js').read_text()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,h,label in [(320,800,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1440,900,'desktop')]:
        page=browser.new_page(viewport={'width':w,'height':h})
        page.set_content(html,wait_until='load')
        page.add_script_tag(content=ui3)
        page.wait_for_timeout(80)
        check(label+' UI3 body',page.locator('body.ui3-page').count()==1)
        check(label+' bundle UI hook',page.locator('body[data-ui-auto-bundle="408-UI-3.4"]').count()==1)
        check(label+' universal header',page.locator('.ui3-site-header').count()==1)
        check(label+' universal footer',page.locator('.ui3-site-footer').count()==1)
        check(label+' h1 visible',page.get_by_role('heading',name='Review Home + Auto Together.').is_visible())
        check(label+' visual card visible',page.locator('.visual-card').is_visible())
        check(label+' quote card visible',page.locator('.quote-card').is_visible())
        check(label+' form visible',page.locator('#leadForm').is_visible())
        check(label+' three process cards',page.locator('.steps article').count()==3)
        check(label+' producer module',page.locator('.agent-section').is_visible())
        no_overflow(page,label+' no horizontal overflow')
        target(page,'.primary-button',label+' primary submit',48)
        target(page,'#leadForm input[name="first_name"]',label+' input',48)
        red=page.locator('.primary-button').evaluate('e=>getComputedStyle(e).backgroundColor')
        check(label+' red primary',red in ('rgb(215, 25, 32)','rgba(215, 25, 32, 1)'))
        radius=float(page.locator('.quote-card').evaluate('e=>parseFloat(getComputedStyle(e).borderRadius)'))
        check(label+' restrained card radius',10<=radius<=22.5)
        if w>=981:
            cols=page.locator('.hero').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' split hero',len(cols.split())==2)
        if w<=980:
            cols=page.locator('.hero').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' stacked hero',len(cols.split())==1)
        if w<=760:
            fg=page.locator('.field-grid').first.evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' one-column field grid',len(fg.split())==1)
        if w<=620:
            fs=float(page.locator('#leadForm input[name="first_name"]').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)'))
            check(label+' 16px mobile input',fs>=16)
        if w<=860:
            check(label+' mobile menu toggle visible',page.locator('.ui3-menu-toggle').is_visible())
            page.locator('.ui3-menu-toggle').click()
            check(label+' menu opens',page.locator('.ui3-menu-toggle').get_attribute('aria-expanded')=='true')
            target(page,'.ui3-primary-nav a',label+' mobile nav target',44)
            page.keyboard.press('Escape')
            check(label+' Escape closes menu',page.locator('.ui3-menu-toggle').get_attribute('aria-expanded')=='false')
        page.locator('#leadForm input[name="first_name"]').focus()
        focused=page.locator('#leadForm input[name="first_name"]')
        ring=focused.evaluate('e=>getComputedStyle(e).boxShadow')
        check(label+' focused input visible ring',ring not in ('none',''))
        no_overflow(page,label+' form no overflow')
        page.close()
    browser.close()

failed=[c for c in checks if not c['passed']]
result={'sprint':'408-UI-3.4','suite':'browser_rendering','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(ROOT/'UI3_4_BROWSER_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.4 Browser QA: {result['passed']}/{result['total']} passed")
sys.exit(1 if failed else 0)
