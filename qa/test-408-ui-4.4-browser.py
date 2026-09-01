#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import base64,mimetypes,json,sys
ROOT=Path(__file__).resolve().parents[1]
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
    for script in list(soup.find_all('script',src=True)):
        src=(script.get('src') or '').split('?')[0]
        fp=(ROOT/src.lstrip('/')) if src.startswith('/') else (pp.parent/src).resolve()
        if fp.exists() and src.endswith(('ui-3-foundation.js','editorial-platform.js')):
            scripts.append((src,fp.read_text()))
        script.decompose()
    for img in soup.find_all('img'):
        src=img.get('src','')
        if not src or src.startswith(('data:','http:','https:')): continue
        fp=(ROOT/src.lstrip('/')) if src.startswith('/') else (pp.parent/src).resolve()
        if fp.exists():
            mime=mimetypes.guess_type(str(fp))[0] or 'application/octet-stream'
            img['src']=f'data:{mime};base64,'+base64.b64encode(fp.read_bytes()).decode()
    for source in soup.find_all('source'): source.attrs.pop('srcset',None)
    st=soup.new_tag('style');st.string='\n'.join(css);soup.head.append(st)
    order={'ui-3-foundation.js':0,'editorial-platform.js':1}
    scripts.sort(key=lambda x:next((v for k,v in order.items() if x[0].endswith(k)),9))
    return str(soup),scripts

def no_overflow(page,label):
    d=page.evaluate('()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
    check(label+' no horizontal overflow',max(d['sw'],d['bw'])<=d['w']+2,str(d))
def visible(page,sel,label):
    loc=page.locator(sel).first; check(label,loc.count()>0 and loc.is_visible())
def target(page,sel,label,h=44):
    loc=page.locator(sel).first; box=loc.bounding_box() if loc.count() and loc.is_visible() else None
    check(label+' visible',box is not None)
    if box: check(label+f' >= {h}px',box['height']>=h-.5,str(box))
html,scripts=inline_page('buyer/index.html')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,h,vp in [(320,820,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1024,900,'laptop'),(1440,1000,'desktop')]:
        page=browser.new_page(viewport={'width':w,'height':h}); page.set_content(html,wait_until='load')
        for _,js in scripts: page.add_script_tag(content=js)
        page.wait_for_timeout(120)
        label='buyer-'+vp
        check(label+' marker',page.locator('body.ui44-buyer-editorial[data-ui4-buyer="408-UI-4.4"]').count()==1)
        visible(page,'.ui44-buyer-hero',label+' hero')
        visible(page,'.ui44-buyer-copy h1',label+' h1')
        visible(page,'.ui44-buyer-media',label+' media')
        visible(page,'.ui44-buyer-action #leadForm',label+' form')
        visible(page,'.ui44-buyer-relationship',label+' relationship')
        visible(page,'.ui44-buyer-support',label+' support')
        visible(page,'.ui44-buyer-trust',label+' trust')
        check(label+' one lead form',page.locator('#leadForm').count()==1)
        check(label+' two progress',page.locator('[data-buyer-progress]').count()==2)
        check(label+' three editorial steps',page.locator('.ui44-buyer-support .buyer-promise').count()==3)
        no_overflow(page,label)
        target(page,'.ui44-buyer-actions .buyer-button--primary',label+' hero start',44)
        target(page,'[data-buyer-next]',label+' form next',44)
        target(page,'.ui44-buyer-relationship a[href^="tel:"]',label+' call',44)
        box=page.locator('.ui44-buyer-media').bounding_box();check(label+' media substantial',box is not None and box['height']>=320,str(box))
        if w>=1121:
            cols=page.locator('.ui44-buyer-hero').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' three-zone desktop',len(cols.split())==3,cols)
            sup=page.locator('.ui44-buyer-support').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' three support columns',len(sup.split())==3,sup)
            check(label+' direct header contact',page.locator('.ui4-header-contact').count()==1 and page.locator('.ui4-header-contact').is_visible())
        elif w<=860:
            cols=page.locator('.ui44-buyer-hero').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' single-column hero',len(cols.split())==1,cols)
            sup=page.locator('.ui44-buyer-support').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' single-column support',len(sup.split())==1,sup)
            check(label+' menu toggle',page.locator('.ui3-menu-toggle').count()==1 and page.locator('.ui3-menu-toggle').is_visible())
        if w<=620:
            fg=page.locator('.buyer-field-grid').first.evaluate('e=>getComputedStyle(e).gridTemplateColumns')
            check(label+' one-column fields',len(fg.split())==1,fg)
            fs=float(page.locator('#leadForm input[name="property_address"]').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)'))
            check(label+' 16px input',fs>=16,str(fs))
        page.close()
    browser.close()
passed=sum(c['passed'] for c in checks)
out={'sprint':'408-UI-4.4','suite':'buyer_editorial_browser','total':len(checks),'passed':passed,'failed':len(checks)-passed,'checks':checks}
(ROOT/'UI4_4_BROWSER_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-4.4 Browser QA: {passed}/{len(checks)} passed')
sys.exit(0 if passed==len(checks) else 1)
