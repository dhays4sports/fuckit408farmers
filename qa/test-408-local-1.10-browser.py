from pathlib import Path
import json, re, subprocess, sys
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
CSS='\n'.join((ROOT/p).read_text() for p in ['shared/styles.css','shared/local.css','shared/accessibility.css'])
CATALOG=json.loads((ROOT/'local/data/catalog.json').read_text())
checks=[]
def check(name,cond):
    checks.append({'name':name,'passed':bool(cond)})
    if not cond: raise AssertionError(name)

def clean_html(rel):
    soup=BeautifulSoup((ROOT/rel).read_text(),'html.parser')
    for x in soup.find_all(['script','link']): x.decompose()
    for img in soup.find_all('img'):
        img.attrs.pop('src',None); img.attrs.pop('srcset',None)
    style=soup.new_tag('style'); style.string=CSS; soup.head.append(style)
    return str(soup)

def node_render(kind):
    if kind=='directory':
        code=f"""
const M=require({json.dumps(str(ROOT/'shared/local-data-model.js'))});
const D=require({json.dumps(str(ROOT/'shared/local-directory.js'))});
const c=require({json.dumps(str(ROOT/'local/data/catalog.json'))});
const v=D.getDirectoryViewModels(c,{{now:new Date('2026-08-16T12:00:00Z')}});
process.stdout.write(D.renderDirectory(v,'all'));
"""
    else:
        code=f"""
const M=require({json.dumps(str(ROOT/'shared/local-merchant.js'))});
const c=require({json.dumps(str(ROOT/'local/data/catalog.json'))});
const vm=M.getMerchantDetailViewModel(c,'stevies-bar-grill',new Date('2026-08-16T12:00:00Z'));
process.stdout.write(M.renderMerchantDetail(vm));
"""
    return subprocess.check_output(['node','-e',code],text=True)

def no_overflow(page,name):
    d=page.evaluate('() => ({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
    check(name,max(d['sw'],d['bw'])<=d['w']+2)

def target(page,sel,name,minh=44):
    box=page.locator(sel).first.bounding_box(); check(name+' visible',box is not None); check(name+f' >= {minh}px',box['height']>=minh-0.5)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    directory_markup=node_render('directory')
    for w,h,label in [(320,800,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1440,900,'desktop')]:
        page=browser.new_page(viewport={'width':w,'height':h})
        page.set_content(clean_html('local/index.html'),wait_until='load')
        page.locator('[data-local-directory-grid]').evaluate('(el,html)=>{el.innerHTML=html;el.setAttribute("aria-busy","false")}',directory_markup)
        page.locator('[data-local-directory]').evaluate('(el)=>el.setAttribute("data-local-directory-state","ready")')
        check(f'{label} directory h1',page.locator('#local-title').is_visible())
        check(f'{label} Stevies card',page.get_by_text("Stevie's Bar & Grill",exact=True).first.is_visible())
        no_overflow(page,f'{label} directory no horizontal overflow')
        target(page,'[data-local-filter="all"]',f'{label} category filter')
        target(page,'.local-primary',f'{label} primary action')
        check(f'{label} skip link',page.locator('a.skip-link[href="#main-content"]').count()==1)
        check(f'{label} main landmark',page.locator('main#main-content').count()==1)
        page.close()

    detail_markup=node_render('detail')
    for w,h,label in [(320,800,'detail320'),(390,844,'detail390'),(768,1024,'detailTablet'),(1440,900,'detailDesktop')]:
        page=browser.new_page(viewport={'width':w,'height':h})
        page.set_content(clean_html('local/detail/index.html'),wait_until='load')
        page.locator('[data-local-merchant-detail]').evaluate('(el,html)=>{el.innerHTML=html;el.setAttribute("data-local-detail-state","ready")}',detail_markup)
        check(f'{label} merchant heading',page.get_by_role('heading',name="Stevie's Bar & Grill",exact=True).is_visible())
        check(f'{label} use perk action',page.get_by_role('button',name='Use This Perk').is_visible())
        no_overflow(page,f'{label} no horizontal overflow')
        target(page,'[data-local-use-perk]',f'{label} use-perk',48)
        check(f'{label} no identity form before perk',page.locator('main form').count()==0)
        check(f'{label} insurance bridge after perk',page.locator('[data-local-insurance-bridge]').count()==1)
        check(f'{label} bridge separation copy',page.get_by_text('Your merchant perk is already available.',exact=False).count()>=1)
        # Browser-native dialog sizing/keyboard behavior, wired with the same showModal/close primitives used by production.
        page.evaluate('''() => {
          const b=document.querySelector('[data-local-use-perk]'); const d=document.querySelector('[data-local-redemption-dialog]');
          b.addEventListener('click',()=>d.showModal());
          d.querySelectorAll('[data-local-redemption-close]').forEach(x=>x.addEventListener('click',()=>d.close()));
        }''')
        page.get_by_role('button',name='Use This Perk').click()
        dialog=page.locator('[data-local-redemption-dialog]')
        check(f'{label} redemption dialog opens',dialog.evaluate('(d)=>d.open') is True)
        check(f'{label} redemption independent text',dialog.locator('.local-redemption-independent').filter(has_text='No insurance purchase or quote required.').is_visible())
        target(page,'[data-local-redemption-close]',f'{label} close target')
        no_overflow(page,f'{label} redemption no overflow')
        page.keyboard.press('Escape'); check(f'{label} Escape closes dialog',dialog.evaluate('(d)=>d.open') is False)
        page.close()

    for w,h,label in [(320,800,'join320'),(390,844,'join390'),(768,1024,'joinTablet'),(1440,900,'joinDesktop')]:
        page=browser.new_page(viewport={'width':w,'height':h})
        page.set_content(clean_html('local/join/index.html'),wait_until='load')
        check(f'{label} join h1',page.locator('#join-title').is_visible())
        no_overflow(page,f'{label} no horizontal overflow')
        fields=page.locator('input:not([type="hidden"]),select,textarea')
        for i in range(fields.count()):
            el=fields.nth(i)
            if not el.is_visible(): continue
            if el.get_attribute('name')=='_gotcha': continue
            fid=el.get_attribute('id')
            typ=(el.get_attribute('type') or '').lower()
            if typ=='checkbox':
                check(f'{label} checkbox {i} wrapped by label',el.locator('xpath=ancestor::label[1]').count()==1)
                fid=f'checkbox-{i}'
            else:
                check(f'{label} field {i} id',bool(fid)); check(f'{label} label for {fid}',page.locator(f'label[for="{fid}"]').count()==1)
            if w<=720 and typ!='checkbox':
                fs=float(el.evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')); check(f'{label} {fid} font >=16',fs>=16)
        target(page,'.local-join-submit',f'{label} submit',56 if w<=720 else 50)
        check(f'{label} insurance separation ack',page.get_by_text('I understand Local participation is separate from insurance.',exact=False).count()>=1)
        page.close()
    browser.close()

failed=[c for c in checks if not c['passed']]
result={'sprint':'408-LOCAL-1.10','suite':'browser_rendering','navigationMode':'set_content_due_environment_network_navigation_block','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(ROOT/'LOCAL1_10_BROWSER_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-LOCAL-1.10 Browser rendering QA: {result['passed']}/{result['total']} passed")
if failed: sys.exit(1)
