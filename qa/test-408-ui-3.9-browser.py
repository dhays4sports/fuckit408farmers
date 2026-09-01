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
        if not getattr(link,'attrs',None): continue
        if 'stylesheet' not in (link.get('rel') or []): continue
        href=(link.get('href') or '').split('?')[0]
        if href:
            p=(ROOT/href.lstrip('/')) if href.startswith('/') else (page_path.parent/href).resolve()
            if p.exists(): css.append(p.read_text())
        # Keep link tags in place; set_content cannot fetch them, while preserving malformed legacy sibling parsing.
    for script in list(soup.find_all('script',src=True)): script.decompose()
    for img in soup.find_all('img'):
        img.attrs.pop('src',None);img.attrs.pop('srcset',None)
    style=soup.new_tag('style');style.string='\n'.join(css);soup.head.append(style)
    return str(soup)
def no_overflow(page,label):
    d=page.evaluate('()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
    check(label,max(d['sw'],d['bw'])<=d['w']+2)
def visible(page,sel,label): check(label,page.locator(sel).first.is_visible())
def h(page,sel):
    b=page.locator(sel).first.bounding_box();return b['height'] if b else 0
ui3=(ROOT/'shared/ui-3-foundation.js').read_text()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    cases=[
      ('home/thank-you.html','.thanks-card','Thanks!'),
      ('buyer/thank-you.html','.buyer-thanks-card','Your buyer review is started.'),
      ('life/thank-you.html','.life-thanks-card','Your application is next.'),
      ('local/join/thank-you.html','.local-join-thanks','Thanks for introducing your business.'),
      ('contact/index.html','.contact-choice-card','Choose the easiest way to reach Dylan.'),
      ('privacy.html','.thanks-card','Privacy Notice'),
      ('terms.html','.thanks-card','Website Terms'),
      ('neighbor/index.html','.referral-bridge-panel','Preparing your personalized CoverageFit review'),
      ('404.html','.ui3-error-card','That page isn’t here.')
    ]
    for w,hgt,vp in [(320,800,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1440,900,'desktop')]:
      for rel,card,heading in cases:
        tag=rel.replace('/','-')+'-'+vp
        page=browser.new_page(viewport={'width':w,'height':hgt})
        page.set_content(inline_page(rel),wait_until='load')
        page.add_script_tag(content=ui3);page.wait_for_timeout(40)
        check(tag+' ui3 body',page.locator('body.ui3-page').count()==1)
        check(tag+' header',page.locator('.ui3-site-header').count()==1)
        check(tag+' footer',page.locator('.ui3-site-footer').count()==1)
        visible(page,card,tag+' card visible')
        check(tag+' heading visible',page.get_by_role('heading',name=heading,exact=True).is_visible())
        no_overflow(page,tag+' no overflow')
        if w<=860: check(tag+' mobile menu',page.locator('.ui3-menu-toggle').is_visible())
        radius=float(page.locator(card).first.evaluate('e=>parseFloat(getComputedStyle(e).borderRadius)'))
        check(tag+' restrained radius',8<=radius<=22.5)
        page.close()

    # Receipt-specific hierarchy.
    page=browser.new_page(viewport={'width':390,'height':844})
    page.set_content(inline_page('home/thank-you.html'));page.add_script_tag(content=ui3);page.wait_for_timeout(40)
    check('home receipt next steps',page.get_by_role('heading',name='What happens next').is_visible())
    check('home receipt four statements',page.locator('.next-steps p').count()==4)
    check('home receipt Local after next steps',page.evaluate("()=>{const a=document.querySelector('.next-steps'),b=document.querySelector('.post-submit-local');return !!(a&&b&&(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING));}"))
    check('home receipt primary touch target',h(page,'.thanks-actions .primary')>=44)
    page.close()

    # Contact task actions remain prominent.
    page=browser.new_page(viewport={'width':390,'height':844})
    page.set_content(inline_page('contact/index.html'));page.add_script_tag(content=ui3);page.wait_for_timeout(40)
    for sel,label in [('[data-contact-sms]','sms'),('.contact-method[href="tel:+14083276377"]','call'),('[data-contact-email]','email')]:
        visible(page,sel,'contact '+label+' visible');check('contact '+label+' touch target',h(page,sel)>=44)
    page.close()

    # Life receipt remains dark / campaign-specific.
    page=browser.new_page(viewport={'width':390,'height':844})
    page.set_content(inline_page('life/thank-you.html'));page.add_script_tag(content=ui3);page.wait_for_timeout(40)
    bg=page.locator('.life-thanks').evaluate('e=>getComputedStyle(e).backgroundImage')
    color=page.locator('.life-thanks-card h1').evaluate('e=>getComputedStyle(e).color')
    check('life receipt dark campaign background','gradient' in bg.lower())
    check('life receipt white headline',color in ('rgb(255, 255, 255)','rgba(255, 255, 255, 1)'))
    page.close()

    # 404 presents three useful exits.
    page=browser.new_page(viewport={'width':390,'height':844})
    page.set_content(inline_page('404.html'));page.add_script_tag(content=ui3);page.wait_for_timeout(40)
    check('404 three exits',page.locator('.ui3-error-actions a').count()==3)
    check('404 primary touch target',h(page,'.ui3-error-actions .primary')>=44)
    page.close()
    browser.close()
failed=[c for c in checks if not c['passed']]
result={'sprint':'408-UI-3.9','suite':'browser_rendering','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'viewports':['320x800','390x844','768x1024','1440x900'],'checks':checks}
(ROOT/'UI3_9_BROWSER_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.9 Browser QA: {result['passed']}/{result['total']} passed")
sys.exit(1 if failed else 0)
