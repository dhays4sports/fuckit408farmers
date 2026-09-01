#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json,sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,cond,detail=''):
    checks.append({'name':name,'passed':bool(cond),'detail':detail})
    if not cond: print('FAIL',name,detail)
def inline_page(rel):
    pp=ROOT/rel; soup=BeautifulSoup(pp.read_text(),'html.parser'); css=[]
    for link in list(soup.find_all('link')):
        if 'stylesheet' not in (link.get('rel') or []): continue
        href=(link.get('href') or '').split('?')[0]
        p=(ROOT/href.lstrip('/')) if href.startswith('/') else (pp.parent/href).resolve()
        if p.exists(): css.append(p.read_text())
        link.decompose()
    for script in list(soup.find_all('script',src=True)): script.decompose()
    st=soup.new_tag('style'); st.string='\n'.join(css); soup.head.append(st)
    return str(soup)
def no_overflow(page,label):
    d=page.evaluate('()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
    check(label,max(d['sw'],d['bw'])<=d['w']+2,str(d))

def target(page,sel,label,minh=44):
    b=page.locator(sel).first.bounding_box(); check(label+' visible',b is not None)
    if b: check(label+' target',b['height']>=minh-.5,str(b['height']))

routes={'healthcare':'Work in Healthcare?','teachers':'Are You a Teacher?','tech':'Work in Tech?','engineers':'Are You an Engineer?'}
ui3=(ROOT/'shared/ui-3-foundation.js').read_text()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for slug,title in routes.items():
      html=inline_page(f'{slug}/index.html')
      for w,h,label in [(320,800,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1024,768,'desktop1024'),(1440,900,'desktop1440')]:
        tag=f'{slug}-{label}'; page=browser.new_page(viewport={'width':w,'height':h})
        page.set_content(html,wait_until='load'); page.add_script_tag(content=ui3); page.wait_for_timeout(60)
        check(tag+' UI3 body',page.locator('body.ui3-page').count()==1)
        check(tag+' human hook',page.locator('body[data-human-trust-professional="408-UI-3.13.1B"]').count()==1)
        check(tag+' h1',page.get_by_role('heading',name=title).is_visible())
        check(tag+' portrait visible',page.locator('.professional-hero-photo').is_visible())
        check(tag+' Dylan signature visible',page.locator('.professional-signature').is_visible())
        check(tag+' form visible',page.locator('#leadForm').is_visible())
        check(tag+' family switcher',page.locator('.professional-program-switcher a').count()==4)
        check(tag+' no meet Dylan duplicate',page.locator('.quote-card .meet-dylan').count()==0)
        no_overflow(page,tag+' no overflow')
        target(page,'.professional-hero-cta',tag+' hero CTA',44)
        target(page,'#leadForm .primary-button',tag+' form submit',50)
        target(page,'#leadForm input[name="first_name"]',tag+' input',48)
        red=page.locator('#leadForm .primary-button').evaluate('e=>getComputedStyle(e).backgroundColor')
        check(tag+' form CTA red',red in ('rgb(215, 25, 32)','rgba(215, 25, 32, 1)'),red)
        gold=page.locator('.ht-professional-rule').evaluate('e=>getComputedStyle(e).backgroundColor')
        check(tag+' gold identity accent',gold not in ('rgb(215, 25, 32)','rgba(215, 25, 32, 1)','transparent'),gold)
        cols=page.locator('.occupational-hero').evaluate('e=>getComputedStyle(e).gridTemplateColumns').split()
        if w>=1121: check(tag+' 3-column hero',len(cols)==3,str(cols))
        elif w>=761: check(tag+' 2-column editorial hero',len(cols)==2,str(cols))
        else: check(tag+' 1-column mobile hero',len(cols)==1,str(cols))
        if w<=760:
            fs=float(page.locator('#leadForm input[name="first_name"]').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)'))
            check(tag+' 16px mobile input',fs>=16,str(fs))
        no_overflow(page,tag+' final overflow')
        page.close()
    browser.close()
failed=[c for c in checks if not c['passed']]
out={'sprint':'408-UI-3.13.1B','suite':'professional_programs_humanization_browser','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'viewports':['320x800','390x844','768x1024','1024x768','1440x900'],'checks':checks}
(ROOT/'UI3_13_1B_BROWSER_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-3.13.1B browser QA: {out["passed"]}/{out["total"]} passed')
sys.exit(1 if failed else 0)
