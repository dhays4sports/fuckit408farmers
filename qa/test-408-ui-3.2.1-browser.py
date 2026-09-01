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
def inline_page():
    soup=BeautifulSoup((ROOT/'index.html').read_text(),'html.parser')
    css=[]
    for link in soup.find_all('link',rel='stylesheet'):
        href=(link.get('href') or '').split('?')[0]
        p=ROOT/(href.lstrip('/') if href.startswith('/') else href)
        if p.exists(): css.append(p.read_text())
        link.decompose()
    for script in soup.find_all('script',src=True): script.decompose()
    st=soup.new_tag('style');st.string='\n'.join(css);soup.head.append(st)
    return str(soup)
def no_overflow(page,label):
    d=page.evaluate('()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
    check(label+' no horizontal overflow',max(d['sw'],d['bw'])<=d['w']+2)
def target(page,sel,label,minh=44):
    box=page.locator(sel).first.bounding_box();check(label+' visible',box is not None)
    if box: check(label+f' >= {minh}px',box['height']>=minh-.5)
html=inline_page();ui3=(ROOT/'shared/ui-3-foundation.js').read_text()
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
        check(label+' identity h1',page.get_by_role('heading',name='Insurance That Fits.').is_visible())
        check(label+' not quote line',page.get_by_text('Not a quote.',exact=False).first.is_visible())
        check(label+' primary chooser',page.get_by_role('heading',name='What brought you here today?').is_visible())
        check(label+' six situations',page.locator('.ui321-situation-grid a').count()==6)
        check(label+' CoverageFit bridge',page.locator('.ui321-coveragefit-bridge').is_visible())
        check(label+' four secondary products',page.locator('.ui321-secondary-products .ui32-product-card').count()==4)
        check(label+' CoverageFit section',page.locator('#coveragefit').is_visible())
        check(label+' something changed section',page.get_by_role('heading',name='Insurance usually gets reviewed after something changes.').is_visible())
        check(label+' Local module',page.locator('.ui32-local-card').count()==1)
        check(label+' agent module',page.locator('.ui32-agent-grid').count()==1)
        no_overflow(page,label)
        target(page,'.ui32-hero-actions .cf-button--primary',label+' hero primary',48)
        target(page,'.ui321-situation-grid a',label+' situation target',44)
        if w<=620:
            cols=page.locator('.ui321-situation-grid').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' single column situations',len(cols.split())==1)
            scols=page.locator('.ui321-secondary-products .ui32-product-grid').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' single column secondary products',len(scols.split())==1)
        elif w<=900:
            cols=page.locator('.ui321-situation-grid').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' two column situations',len(cols.split())==2)
        else:
            cols=page.locator('.ui321-situation-grid').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' three column situations',len(cols.split())==3)
        if w<=860:
            check(label+' mobile menu toggle visible',page.locator('.ui3-menu-toggle').is_visible())
            page.locator('.ui3-menu-toggle').click()
            check(label+' menu opens',page.locator('.ui3-menu-toggle').get_attribute('aria-expanded')=='true')
            target(page,'.ui3-primary-nav a',label+' mobile nav target',44)
            page.keyboard.press('Escape')
            check(label+' Escape closes menu',page.locator('.ui3-menu-toggle').get_attribute('aria-expanded')=='false')
        page.close()
    browser.close()
failed=[x for x in checks if not x['passed']]
result={'sprint':'408-UI-3.2.1','suite':'browser_rendering','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(ROOT/'UI3_2_1_BROWSER_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.2.1 Browser QA: {result['passed']}/{result['total']} passed")
sys.exit(1 if failed else 0)
