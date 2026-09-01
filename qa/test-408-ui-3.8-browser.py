#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json,subprocess,sys

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
    for img in soup.find_all('img'):
        img.attrs.pop('src',None); img.attrs.pop('srcset',None)
    style=soup.new_tag('style');style.string='\n'.join(css);soup.head.append(style)
    return str(soup)

def node_render(kind):
    if kind=='directory':
        code=f"""
const D=require({json.dumps(str(ROOT/'shared/local-directory.js'))});
const c=require({json.dumps(str(ROOT/'local/data/catalog.json'))});
const v=D.getDirectoryViewModels(c,{{now:new Date('2026-08-17T16:00:00Z')}});
process.stdout.write(D.renderDirectory(v,'all'));
"""
    else:
        code=f"""
const M=require({json.dumps(str(ROOT/'shared/local-merchant.js'))});
const c=require({json.dumps(str(ROOT/'local/data/catalog.json'))});
const vm=M.getMerchantDetailViewModel(c,'stevies-bar-grill',{{now:new Date('2026-08-17T16:00:00Z')}});
process.stdout.write(M.renderMerchantDetail(vm));
"""
    return subprocess.check_output(['node','-e',code],text=True)

def no_overflow(page,label):
    d=page.evaluate('()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
    check(label,max(d['sw'],d['bw'])<=d['w']+2)

def target(page,sel,label,minh=44):
    box=page.locator(sel).first.bounding_box();check(label+' visible',box is not None)
    if box: check(label+f' >= {minh}px',box['height']>=minh-.5)

ui3=(ROOT/'shared/ui-3-foundation.js').read_text()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    directory_markup=node_render('directory')
    for w,h,vp in [(320,800,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1440,900,'desktop')]:
        tag='directory-'+vp
        page=browser.new_page(viewport={'width':w,'height':h})
        page.set_content(inline_page('local/index.html'),wait_until='load')
        page.add_script_tag(content=ui3);page.wait_for_timeout(50)
        page.locator('[data-local-directory-grid]').evaluate('(el,html)=>{el.innerHTML=html;el.setAttribute("aria-busy","false")}',directory_markup)
        page.locator('[data-local-directory]').evaluate('(el)=>el.setAttribute("data-local-directory-state","ready")')
        check(tag+' body hook',page.locator('body[data-ui-local="408-UI-3.8"]').count()==1)
        check(tag+' universal header',page.locator('.ui3-site-header').count()==1)
        check(tag+' universal footer',page.locator('.ui3-site-footer').count()==1)
        check(tag+' compact hero identity',page.get_by_role('heading',name='South Bay Local.').is_visible())
        check(tag+' directory before how',page.evaluate("()=>document.querySelector('#directory').compareDocumentPosition(document.querySelector('#how-it-works')) & Node.DOCUMENT_POSITION_FOLLOWING")!=0)
        check(tag+' Stevies visible',page.get_by_text("Stevie's Bar & Grill",exact=True).first.is_visible())
        check(tag+' no distance copy',page.get_by_text('mi away',exact=False).count()==0)
        check(tag+' no merchant rating UI',page.get_by_text('rating',exact=False).count()==0 and page.locator('[data-rating],.star-rating,.review-count').count()==0)
        target(page,'[data-local-filter="all"]',tag+' filter',40)
        target(page,'.local-merchant-open',tag+' merchant action',20)
        radius=float(page.locator('.local-merchant-card').first.evaluate('e=>parseFloat(getComputedStyle(e).borderRadius)'))
        check(tag+' restrained merchant radius',10<=radius<=18.5)
        cols=page.locator('.local-directory-grid').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
        if w>=981: check(tag+' two-column directory',len(cols.split())==2)
        else: check(tag+' one-column directory',len(cols.split())==1)
        if w<=860:
            check(tag+' mobile menu toggle',page.locator('.ui3-menu-toggle').is_visible())
        no_overflow(page,tag+' no horizontal overflow')
        page.close()

    detail_markup=node_render('detail')
    for w,h,vp in [(320,800,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1440,900,'desktop')]:
        tag='detail-'+vp
        page=browser.new_page(viewport={'width':w,'height':h})
        page.set_content(inline_page('local/detail/index.html'),wait_until='load')
        page.add_script_tag(content=ui3);page.wait_for_timeout(50)
        page.locator('[data-local-merchant-detail]').evaluate('(el,html)=>{el.innerHTML=html;el.setAttribute("data-local-detail-state","ready")}',detail_markup)
        check(tag+' merchant heading',page.get_by_role('heading',name="Stevie's Bar & Grill",exact=True).is_visible())
        check(tag+' perk visible',page.get_by_text('20% off food + non-alcoholic drinks',exact=True).first.is_visible())
        check(tag+' no identity form before perk',page.locator('main form').count()==0)
        check(tag+' insurance bridge present',page.locator('[data-local-insurance-bridge]').count()==1)
        check(tag+' insurance bridge after perk',page.evaluate("()=>{const p=document.querySelector('.local-detail-perk');const b=document.querySelector('[data-local-insurance-bridge]');return !!(p&&b&&(p.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING));}"))
        target(page,'[data-local-use-perk]',tag+' use perk',50)
        no_overflow(page,tag+' no horizontal overflow')
        # wire browser-native dialog exactly as the production primitives do
        page.evaluate('''() => {const b=document.querySelector('[data-local-use-perk]');const d=document.querySelector('[data-local-redemption-dialog]');b.addEventListener('click',()=>d.showModal());d.querySelectorAll('[data-local-redemption-close]').forEach(x=>x.addEventListener('click',()=>d.close()));}''')
        page.locator('[data-local-use-perk]').click()
        dialog=page.locator('[data-local-redemption-dialog]')
        check(tag+' redemption opens',dialog.evaluate('d=>d.open') is True)
        check(tag+' independent text visible',dialog.get_by_text('No insurance purchase or quote required.',exact=False).count()>=1)
        target(page,'[data-local-redemption-close]',tag+' redemption close',44)
        no_overflow(page,tag+' redemption overflow')
        page.keyboard.press('Escape')
        page.close()

    for w,h,vp in [(320,800,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1440,900,'desktop')]:
        tag='join-'+vp
        page=browser.new_page(viewport={'width':w,'height':h})
        page.set_content(inline_page('local/join/index.html'),wait_until='load')
        page.add_script_tag(content=ui3);page.wait_for_timeout(50)
        check(tag+' join heading',page.locator('#join-title').is_visible())
        check(tag+' join form',page.locator('#localMerchantJoinForm').is_visible())
        check(tag+' no insurance gate',page.get_by_text('Local participation is separate from insurance.',exact=False).count()>=1)
        target(page,'.local-join-submit',tag+' submit',50)
        target(page,'input[name="business_name"]',tag+' business name',48)
        radius=float(page.locator('.local-join-form-card').evaluate('e=>parseFloat(getComputedStyle(e).borderRadius)'))
        check(tag+' restrained form radius',10<=radius<=18.5)
        if w<=700:
            fs=float(page.locator('input[name="business_name"]').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)'))
            check(tag+' 16px mobile input',fs>=16)
            fg=page.locator('.local-form-grid--two').first.evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(tag+' one-column form grid',len(fg.split())==1)
        no_overflow(page,tag+' no horizontal overflow')
        page.close()
    browser.close()

failed=[c for c in checks if not c['passed']]
result={'sprint':'408-UI-3.8','suite':'browser_rendering','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'viewports':['320x800','390x844','768x1024','1440x900'],'checks':checks}
(ROOT/'UI3_8_BROWSER_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.8 Browser QA: {result['passed']}/{result['total']} passed")
sys.exit(1 if failed else 0)
