#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import base64,mimetypes,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)
def inline_page(rel):
    pp=ROOT/rel;soup=BeautifulSoup(pp.read_text(),'html.parser');css=[];scripts=[]
    keep=('ui-3-foundation.js','editorial-platform.js','local-community-editorial.js')
    for link in list(soup.find_all('link')):
        if 'stylesheet' not in (link.get('rel') or []): continue
        href=(link.get('href') or '').split('?')[0]
        fp=(ROOT/href.lstrip('/')) if href.startswith('/') else (pp.parent/href).resolve()
        if fp.exists(): css.append(fp.read_text())
        link.decompose()
    for script in list(soup.find_all('script',src=True)):
        src=(script.get('src') or '').split('?')[0]
        fp=(ROOT/src.lstrip('/')) if src.startswith('/') else (pp.parent/src).resolve()
        if fp.exists() and src.endswith(keep): scripts.append((src,fp.read_text()))
        script.decompose()
    for img in soup.find_all('img'):
        src=img.get('src','')
        if not src or src.startswith(('data:','http:','https:')): continue
        fp=(ROOT/src.lstrip('/')) if src.startswith('/') else (pp.parent/src).resolve()
        if fp.exists():
            mime=mimetypes.guess_type(str(fp))[0] or 'application/octet-stream';img['src']=f'data:{mime};base64,'+base64.b64encode(fp.read_bytes()).decode()
    for source in soup.find_all('source'): source.decompose()
    st=soup.new_tag('style');st.string='\n'.join(css);soup.head.append(st)
    return str(soup),scripts

def directory_markup():
    code=f"""
const M=require({json.dumps(str(ROOT/'shared/local-data-model.js'))});
const D=require({json.dumps(str(ROOT/'shared/local-directory.js'))});
const c=require({json.dumps(str(ROOT/'local/data/catalog.json'))});
const v=D.getDirectoryViewModels(c,{{now:new Date('2026-08-19T12:00:00-07:00')}});
process.stdout.write(D.renderDirectory(v,'all'));
"""
    return subprocess.check_output(['node','-e',code],text=True)
def detail_markup():
    code=f"""
const M=require({json.dumps(str(ROOT/'shared/local-merchant.js'))});
const c=require({json.dumps(str(ROOT/'local/data/catalog.json'))});
const vm=M.getMerchantDetailViewModel(c,'stevies-bar-grill',{{now:new Date('2026-08-19T12:00:00-07:00')}});
process.stdout.write(M.renderMerchantDetail(vm));
"""
    return subprocess.check_output(['node','-e',code],text=True)
def no_overflow(page,label):
    d=page.evaluate('()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})');check(label+' no overflow',max(d['sw'],d['bw'])<=d['w']+2,str(d))
def target(page,sel,label,h=44):
    x=page.locator(sel).first;box=x.bounding_box() if x.count() and x.is_visible() else None;check(label+' visible',box is not None)
    if box: check(label+' target',box['height']>=h-.5,str(box))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    dmarkup=directory_markup()
    for w,h,vp in [(320,820,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1024,900,'laptop'),(1440,1000,'desktop')]:
        html,scripts=inline_page('local/index.html'); page=b.new_page(viewport={'width':w,'height':h});page.set_content(html,wait_until='load')
        # Make native filters operational for proxy behavior without loading network scripts.
        page.evaluate('''() => { document.querySelectorAll('[data-local-filter]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-local-filter]').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));})); }''')
        for _,js in scripts: page.add_script_tag(content=js)
        page.locator('[data-local-directory-grid]').evaluate('(el,html)=>{el.innerHTML=html;el.setAttribute("aria-busy","false")}',dmarkup)
        lab='directory-'+vp
        check(lab+' marker',page.locator('body[data-ui4-local="408-UI-4.6"].ui46-local-directory').count()==1)
        for sel,n in [('.ui46-local-hero__copy','copy'),('.ui46-local-hero__media','media'),('.ui46-local-category-panel','category panel'),('[data-local-directory-grid]','grid')]: check(lab+' '+n,page.locator(sel).first.is_visible())
        check(lab+' only real proxies',page.locator('[data-ui46-local-filter]').count()==4)
        check(lab+' stevie',page.get_by_text("Stevie's Bar & Grill",exact=True).count()==1)
        target(page,'[data-ui46-local-filter="eat-drink"]',lab+' hero category')
        target(page,'.ui46-local-category-panel .local-primary',lab+' primary')
        no_overflow(page,lab)
        if w>=1121:
            cols=page.locator('.ui46-local-hero').evaluate('e=>getComputedStyle(e).gridTemplateColumns');check(lab+' three-zone',len(cols.split())==3,cols)
        elif w<=860:
            cols=page.locator('.ui46-local-hero').evaluate('e=>getComputedStyle(e).gridTemplateColumns');check(lab+' one-column',len(cols.split())==1,cols)
        page.locator('[data-ui46-local-filter="eat-drink"]').click(); page.wait_for_timeout(30)
        check(lab+' proxy selection',page.locator('[data-ui46-local-filter="eat-drink"]').get_attribute('aria-pressed')=='true')
        page.close()
    mk=detail_markup()
    for w,h,vp in [(320,820,'phone'),(768,1024,'tablet'),(1440,1000,'desktop')]:
        html,scripts=inline_page('local/detail/index.html');page=b.new_page(viewport={'width':w,'height':h});page.set_content(html,wait_until='load')
        for _,js in scripts: page.add_script_tag(content=js)
        page.locator('[data-local-merchant-detail]').evaluate('(el,html)=>{el.innerHTML=html;el.setAttribute("data-local-detail-state","ready")}',mk)
        lab='detail-'+vp
        check(lab+' stevie',page.get_by_role('heading',name="Stevie's Bar & Grill",exact=True).is_visible())
        check(lab+' perk',page.get_by_role('button',name='Use This Perk').is_visible())
        check(lab+' bridge',page.locator('[data-local-insurance-bridge]').count()==1)
        no_overflow(page,lab);target(page,'[data-local-use-perk]',lab+' use perk',48)
        page.close()
    for rel in ['local/join/index.html','local/join/thank-you.html']:
        for w,h,vp in [(320,820,'phone'),(768,1024,'tablet'),(1440,1000,'desktop')]:
            html,scripts=inline_page(rel);page=b.new_page(viewport={'width':w,'height':h});page.set_content(html,wait_until='load')
            for _,js in scripts: page.add_script_tag(content=js)
            lab=rel+'-'+vp;check(lab+' marker',page.locator('body[data-ui4-local="408-UI-4.6"]').count()==1);no_overflow(page,lab)
            if rel.endswith('index.html'):
                check(lab+' hero',page.locator('.ui46-local-join-hero').is_visible());check(lab+' form',page.locator('#localMerchantJoinForm').count()==1);target(page,'.local-join-submit',lab+' submit',50)
            else: check(lab+' thanks',page.locator('#thanks-title').is_visible())
            page.close()
    b.close()
passed=sum(x['passed'] for x in checks)
out={'sprint':'408-UI-4.6','suite':'local_community_editorial_browser','total':len(checks),'passed':passed,'failed':len(checks)-passed,'checks':checks}
(ROOT/'UI4_6_BROWSER_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-4.6 Browser QA: {passed}/{len(checks)} passed')
sys.exit(0 if passed==len(checks) else 1)
