#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import base64,mimetypes,json,sys
ROOT=Path(__file__).resolve().parents[1]
PROGRAMS=['healthcare','teachers','tech','engineers']
checks=[]
def check(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)
def inline_page(rel):
    pp=ROOT/rel;soup=BeautifulSoup(pp.read_text(),'html.parser');css=[];scripts=[]
    for link in list(soup.find_all('link')):
        if 'stylesheet' not in (link.get('rel') or []): continue
        href=(link.get('href') or '').split('?')[0]
        fp=(ROOT/href.lstrip('/')) if href.startswith('/') else (pp.parent/href).resolve()
        if fp.exists(): css.append(fp.read_text())
        link.decompose()
    keep=('ui-3-foundation.js','editorial-platform.js','campaign-entry-registry.js','campaign-entry.js','professional-programs-editorial.js')
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
def no_overflow(page,label):
    d=page.evaluate('()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
    check(label+' no overflow',max(d['sw'],d['bw'])<=d['w']+2,str(d))
def visible(page,sel,label):
    x=page.locator(sel).first;check(label,x.count()>0 and x.is_visible())
def target(page,sel,label,h=44):
    x=page.locator(sel).first;box=x.bounding_box() if x.count() and x.is_visible() else None;check(label+' visible',box is not None)
    if box: check(label+' target',box['height']>=h-.5,str(box))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for prog in PROGRAMS:
        html,scripts=inline_page(f'{prog}/index.html')
        for w,h,vp in [(320,820,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1024,900,'laptop'),(1440,1000,'desktop')]:
            page=b.new_page(viewport={'width':w,'height':h});page.set_content(html,wait_until='load')
            for _,js in scripts: page.add_script_tag(content=js)
            page.wait_for_timeout(100);lab=f'{prog}-{vp}'
            check(lab+' marker',page.locator('body.ui45-professional-editorial[data-ui4-professional="408-UI-4.5"]').count()==1)
            visible(page,'.ui45-professional-hero',lab+' hero');visible(page,'.ui45-professional-copy h1',lab+' h1');visible(page,'.ui45-professional-media',lab+' media');visible(page,'.ui45-professional-action #leadForm',lab+' form');visible(page,'.ui45-professional-relationship',lab+' relationship');visible(page,'.ui45-professional-support',lab+' support')
            check(lab+' one form',page.locator('#leadForm').count()==1);check(lab+' four program links',page.locator('.professional-program-switcher a').count()==4);check(lab+' three support cols DOM',page.locator('.ui45-professional-support > .ui4-editorial-column').count()==3)
            no_overflow(page,lab);target(page,'.ui45-professional-hero-cta',lab+' hero cta');target(page,'.ui45-professional-panel .primary-button',lab+' submit');target(page,'.ui45-professional-relationship a[href^="tel:"]',lab+' call')
            if w>=1181:
                cols=page.locator('.ui45-professional-hero').evaluate('e=>getComputedStyle(e).gridTemplateColumns');check(lab+' three-zone',len(cols.split())==3,cols)
                sup=page.locator('.ui45-professional-support').evaluate('e=>getComputedStyle(e).gridTemplateColumns');check(lab+' three support',len(sup.split())==3,sup)
            elif w<=860:
                cols=page.locator('.ui45-professional-hero').evaluate('e=>getComputedStyle(e).gridTemplateColumns');check(lab+' one-column hero',len(cols.split())==1,cols)
                sup=page.locator('.ui45-professional-support').evaluate('e=>getComputedStyle(e).gridTemplateColumns');check(lab+' one-column support',len(sup.split())==1,sup)
            if w<=560:
                fg=page.locator('#leadForm .field-grid').first.evaluate('e=>getComputedStyle(e).gridTemplateColumns');check(lab+' one-column fields',len(fg.split())==1,fg)
                fs=float(page.locator('#leadForm input[name="property_address"]').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)'));check(lab+' 16px input',fs>=16,str(fs))
            page.close()
    b.close()
passed=sum(x['passed'] for x in checks)
out={'sprint':'408-UI-4.5','suite':'professional_programs_editorial_browser','total':len(checks),'passed':passed,'failed':len(checks)-passed,'checks':checks}
(ROOT/'UI4_5_BROWSER_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-4.5 Browser QA: {passed}/{len(checks)} passed')
sys.exit(0 if passed==len(checks) else 1)
