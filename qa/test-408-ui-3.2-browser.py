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

def inline_home():
    soup=BeautifulSoup((ROOT/'index.html').read_text(),'html.parser')
    css=[]
    for link in soup.find_all('link',rel='stylesheet'):
        href=(link.get('href') or '').split('?')[0]
        p=ROOT/(href.lstrip('/') if href.startswith('/') else href)
        if p.exists(): css.append(p.read_text())
        link.decompose()
    for script in soup.find_all('script',src=True): script.decompose()
    style=soup.new_tag('style');style.string='\n'.join(css);soup.head.append(style)
    return str(soup)

def no_overflow(page,label):
    d=page.evaluate('()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
    check(label,max(d['sw'],d['bw'])<=d['w']+2)

def target(page,sel,label,minh=44):
    box=page.locator(sel).first.bounding_box();check(label+' visible',box is not None)
    if box: check(label+f' >= {minh}px',box['height']>=minh-.5)

html=inline_home(); ui3=(ROOT/'shared/ui-3-foundation.js').read_text()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,h,label in [(320,800,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1440,900,'desktop')]:
        page=browser.new_page(viewport={'width':w,'height':h})
        page.set_content(html,wait_until='load')
        page.add_script_tag(content=ui3)
        page.wait_for_timeout(80)
        check(label+' UI3 body',page.locator('body.ui3-page').count()==1)
        check(label+' universal header',page.locator('.ui3-site-header').count()==1)
        check(label+' universal footer',page.locator('.ui3-site-footer').count()==1)
        check(label+' h1 visible',page.get_by_role('heading',name='Insurance for South Bay households.').is_visible())
        check(label+' four product cards',page.locator('.ui32-product-card').count()==4)
        check(label+' Home route',page.locator('.ui32-product-card[href="home/"]').count()==1)
        check(label+' Home Auto route',page.locator('.ui32-product-card[href="auto-bundle/"]').count()==1)
        check(label+' Buyer route',page.locator('.ui32-product-card[href="buyer/"]').count()==1)
        check(label+' Life route',page.locator('.ui32-product-card[href="life/"]').count()==1)
        check(label+' Local module',page.locator('.ui32-local-card').count()==1)
        check(label+' Dylan module',page.locator('.ui32-agent-grid').count()==1)
        no_overflow(page,label+' no horizontal overflow')
        target(page,'.ui32-hero-actions .cf-button--primary',label+' hero primary',48)
        if w<=620:
            check(label+' single column products',page.locator('.ui32-product-grid').evaluate('e=>getComputedStyle(e).gridTemplateColumns').count(' ')==0)
        if w<=860:
            check(label+' mobile menu toggle visible',page.locator('.ui3-menu-toggle').is_visible())
            page.locator('.ui3-menu-toggle').click()
            check(label+' menu opens',page.locator('.ui3-menu-toggle').get_attribute('aria-expanded')=='true')
            target(page,'.ui3-primary-nav a',label+' mobile nav target',44)
            page.keyboard.press('Escape')
            check(label+' Escape closes menu',page.locator('.ui3-menu-toggle').get_attribute('aria-expanded')=='false')
        # headshot wrapper cannot inherit the old intrinsic 835px height.
        box=page.locator('.ui32-agent-photo picture').bounding_box()
        if box: check(label+' headshot normalized',abs(box['width']-box['height'])<2)
        page.close()
    browser.close()

failed=[c for c in checks if not c['passed']]
result={'sprint':'408-UI-3.2','suite':'browser_rendering','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(ROOT/'UI3_2_BROWSER_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.2 Browser QA: {result['passed']}/{result['total']} passed")
sys.exit(1 if failed else 0)
