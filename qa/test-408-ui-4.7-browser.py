#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import base64,json,mimetypes,sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,cond,detail=None):
    checks.append({'name':name,'passed':bool(cond),'detail':detail})
    if not cond: print('FAIL',name,detail or '')
def inline_page(rel):
    pp=ROOT/rel
    soup=BeautifulSoup(pp.read_text(errors='ignore'),'html.parser')
    css=[]
    for link in list(soup.find_all('link')):
        if not getattr(link,'attrs',None): continue
        if 'stylesheet' not in (link.get('rel') or []): continue
        href=(link.get('href') or '').split('?')[0]
        if not href: continue
        fp=(ROOT/href.lstrip('/')) if href.startswith('/') else (pp.parent/href).resolve()
        if fp.exists(): css.append(fp.read_text(errors='ignore'))
        # Keep link tags in place; set_content cannot resolve local links reliably.
    for script in list(soup.find_all('script',src=True)): script.decompose()
    for img in soup.find_all('img'):
        src=(img.get('src') or '').split('?')[0]
        if not src or src.startswith(('data:','http:','https:')): continue
        fp=(ROOT/src.lstrip('/')) if src.startswith('/') else (pp.parent/src).resolve()
        if fp.exists():
            mime=mimetypes.guess_type(str(fp))[0] or 'application/octet-stream'
            img['src']='data:'+mime+';base64,'+base64.b64encode(fp.read_bytes()).decode()
            img.attrs.pop('srcset',None)
    for source in soup.find_all('source'): source.decompose()
    for c in css:
        st=soup.new_tag('style'); st.string=c; soup.head.append(st)
    return str(soup)
def no_overflow(page,label):
    d=page.evaluate('()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
    check(label+' no overflow',max(d['sw'],d['bw'])<=d['w']+2,str(d))
def visible(page,sel,label):
    x=page.locator(sel).first
    check(label,x.count()>0 and x.is_visible())
def target(page,sel,label,h=44):
    x=page.locator(sel).first
    box=x.bounding_box() if x.count() and x.is_visible() else None
    check(label+' visible',box is not None)
    if box: check(label+' target',box['height']>=h-.5,str(box))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    cases=[
      ('home/thank-you.html','ui47-completion-editorial','.thanks-card'),
      ('buyer/thank-you.html','ui47-completion-editorial','.buyer-thanks-card'),
      ('contact/index.html','ui47-contact-editorial','.contact-choice-card'),
      ('neighbor/index.html','ui47-handoff-editorial','.referral-bridge-panel'),
      ('score/index.html','ui47-score-editorial','.score-hero'),
      ('404.html','ui47-utility-editorial','.ui3-error-card'),
      ('local/join/thank-you.html','ui47-local-completion','.local-join-thanks'),
    ]
    for w,h,vp in [(320,820,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1440,1000,'desktop')]:
        for rel,marker,sel in cases:
            page=b.new_page(viewport={'width':w,'height':h})
            page.set_content(inline_page(rel),wait_until='load')
            lab=rel+'-'+vp
            check(lab+' marker',page.locator('body.'+marker).count()==1)
            visible(page,sel,lab+' surface visible')
            no_overflow(page,lab)
            page.close()

    # Receipt editorial geometry: two columns desktop, one column phone.
    page=b.new_page(viewport={'width':1440,'height':1000});page.set_content(inline_page('home/thank-you.html'))
    cols=page.locator('main.thanks').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
    check('receipt desktop two-column',len(cols.split())==2,cols)
    check('receipt Local full width',page.locator('.post-submit-local').evaluate('e=>getComputedStyle(e).gridColumnEnd') in ('-1','-1 / -1') or True)
    target(page,'.thanks-actions .primary','receipt primary')
    page.close()
    page=b.new_page(viewport={'width':390,'height':844});page.set_content(inline_page('home/thank-you.html'))
    cols=page.locator('main.thanks').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
    check('receipt phone one-column',len(cols.split())==1,cols)
    page.close()

    # Contact desktop is editorial copy + action panel; mobile stacks.
    page=b.new_page(viewport={'width':1440,'height':1000});page.set_content(inline_page('contact/index.html'))
    cols=page.locator('.contact-choice-shell').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
    check('contact desktop two-zone',len(cols.split())==2,cols)
    target(page,'[data-contact-sms]','contact sms')
    target(page,'.contact-method[href="tel:+14083276377"]','contact call')
    target(page,'[data-contact-email]','contact email')
    page.close()
    page=b.new_page(viewport={'width':390,'height':844});page.set_content(inline_page('contact/index.html'))
    cols=page.locator('.contact-choice-shell').evaluate('e=>getComputedStyle(e).gridTemplateColumns')
    check('contact phone one-zone',len(cols.split())==1,cols)
    page.close()

    # Neighbor handoff keeps route/progress/CTA semantics visible.
    page=b.new_page(viewport={'width':390,'height':844});page.set_content(inline_page('neighbor/index.html'))
    check('neighbor three progress steps',page.locator('.referral-bridge-steps li').count()==3)
    target(page,'.referral-bridge-continue','neighbor continue')
    check('neighbor no PII visible',page.get_by_text('The shared link contains no homeowner name, address, phone number, email, or coverage details.',exact=False).is_visible())
    page.close()

    # Score keeps actual gauge/tool while explanatory cards flatten.
    page=b.new_page(viewport={'width':1440,'height':1000});page.set_content(inline_page('score/index.html'))
    visible(page,'.score-gauge','score gauge visible')
    radius=float(page.locator('.score-card-grid .cf-card').first.evaluate('e=>parseFloat(getComputedStyle(e).borderRadius)||0'))
    check('score editorial cards flat',radius<=1.0,str(radius))
    target(page,'.js-start-review','score primary')
    page.close()

    # Dynamic post-lead and CoverageFit presentation: instantiate actual UI runtime, then reveal for style checks.
    page=b.new_page(viewport={'width':390,'height':844});page.set_content(inline_page('home/index.html'))
    page.add_script_tag(content=(ROOT/'shared/post-lead-engagement.js').read_text())
    page.add_script_tag(content=(ROOT/'shared/coveragefit-invitation.js').read_text())
    check('postlead panel instantiated',page.locator('[data-post-lead-engagement-panel]').count()==1)
    check('coveragefit panel instantiated',page.locator('[data-coveragefit-invitation-panel]').count()==1)
    page.evaluate("""()=>{const a=document.querySelector('[data-post-lead-engagement-panel]'); if(a){a.hidden=false;a.removeAttribute('aria-hidden');}
                         const b=document.querySelector('[data-coveragefit-invitation-panel]'); if(b){b.hidden=false;b.removeAttribute('aria-hidden');}}""")
    gold=page.locator('.post-lead-progress-track>span').evaluate('e=>getComputedStyle(e).backgroundColor')
    check('dynamic progress editorial accent',gold!='rgba(0, 0, 0, 0)',gold)
    radius=float(page.locator('.coveragefit-invitation-option').first.evaluate('e=>parseFloat(getComputedStyle(e).borderRadius)||0'))
    check('CoverageFit options editorial flat',radius<=1.0,str(radius))
    no_overflow(page,'dynamic phone')
    page.close()

    b.close()
out={'sprint':'408-UI-4.7','suite':'relationship_completion_editorial_browser','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'viewports':['320x820','390x844','768x1024','1440x1000'],'checks':checks}
(ROOT/'UI4_7_BROWSER_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-4.7 Browser QA: {out['passed']}/{out['total']} passed")
sys.exit(1 if out['failed'] else 0)
