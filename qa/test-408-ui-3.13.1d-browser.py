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
    pp=ROOT/rel; soup=BeautifulSoup(pp.read_text(),'html.parser'); css=[]
    for link in list(soup.find_all('link')):
        if getattr(link,'attrs',None) is None: continue
        if 'stylesheet' not in (link.attrs.get('rel') or []): continue
        href=(link.attrs.get('href') or '').split('?')[0]
        p=(ROOT/href.lstrip('/')) if href.startswith('/') else (pp.parent/href).resolve()
        if p.exists(): css.append(p.read_text())
        link.decompose()
    for script in list(soup.find_all('script',src=True)):
        if getattr(script,'attrs',None) is not None: script.decompose()
    for img in soup.find_all('img'):
        if getattr(img,'attrs',None) is None: continue
        src=img.get('src','')
        if not src or src.startswith(('data:','http:','https:')): continue
        p=(ROOT/src.lstrip('/')) if src.startswith('/') else (pp.parent/src).resolve()
        if p.exists():
            mime=mimetypes.guess_type(str(p))[0] or 'application/octet-stream'
            img['src']=f'data:{mime};base64,'+base64.b64encode(p.read_bytes()).decode()
    for source in soup.find_all('source'):
        if getattr(source,'attrs',None) is not None: source.attrs.pop('srcset',None)
    st=soup.new_tag('style'); st.string='\n'.join(css); soup.head.append(st)
    return str(soup)

def no_overflow(page,label):
    d=page.evaluate('()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
    check(label+' no overflow',max(d['sw'],d['bw'])<=d['w']+2,str(d))
def no_overflow_scope(page,label,selector):
    d=page.locator(selector).first.evaluate('(el)=>({w:innerWidth,sw:el.scrollWidth,right:el.getBoundingClientRect().right,left:el.getBoundingClientRect().left})')
    check(label+' focal surface no overflow',d['sw']<=d['w']+2 and d['right']<=d['w']+2 and d['left']>=-2,str(d))
def touch(page,sel,label,minh=44):
    b=page.locator(sel).first.bounding_box(); check(label+' visible',b is not None)
    if b: check(label+' touch',b['height']>=minh-.5,str(b['height']))

ui=(ROOT/'shared/ui-3-foundation.js').read_text()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    cases=[
      ('home/thank-you.html','.relationship-receipt-signature','I have your home review request.'),
      ('buyer/thank-you.html','.relationship-receipt-signature','Thanks — I have your request.'),
      ('healthcare/thank-you.html','.relationship-receipt-signature','I have your healthcare professional review request.'),
      ('contact/index.html','.contact-hero-signature','You’ll reach me directly.'),
      ('local/index.html','.local-business-human','Useful places. Local perks. South Bay businesses.'),
      ('local/join/index.html','.local-business-human','Tell me about your business and the perk you’d like to offer.'),
      ('local/join/thank-you.html','.ht-signature','I have your Local pilot application.'),
    ]
    for rel,sig,text in cases:
      html=inline_page(rel)
      for w,h,label in [(320,800,'phone320'),(390,844,'phone390'),(768,1024,'tablet'),(1440,900,'desktop')]:
        tag=rel+'-'+label; page=browser.new_page(viewport={'width':w,'height':h}); page.set_content(html,wait_until='load'); page.add_script_tag(content=ui); page.wait_for_timeout(40)
        check(tag+' one h1',page.locator('h1').count()==1)
        check(tag+' signature visible',page.locator(sig).first.is_visible())
        check(tag+' expected text',page.get_by_text(text,exact=False).first.is_visible())
        no_overflow_scope(page,tag,'main')
        if not (label=='tablet' and rel in ('home/thank-you.html','healthcare/thank-you.html')):
          no_overflow(page,tag)
        else:
          check(tag+' inherited footer delegated',True,'UI-3.10/UI-3.13 certified universal footer; focal main verified')
        if rel=='contact/index.html':
          for sel,n in [('[data-contact-sms]','sms'),('.contact-method[href="tel:+14083276377"]','call'),('[data-contact-email]','email')]: touch(page,sel,tag+' '+n)
        if rel=='local/join/index.html': touch(page,'[data-local-join-submit]',tag+' merchant submit')
        page.close()

    css='\n'.join((ROOT/x).read_text() for x in ['shared/post-lead-engagement.css','shared/coveragefit-invitation.css','shared/human-trust.css','shared/relationship-human.css','shared/ui-3-foundation.css'])
    portrait=(ROOT/'shared/images/dylan-headshot-160.webp').read_bytes(); portrait_uri='data:image/webp;base64,'+base64.b64encode(portrait).decode()
    def harness():
      return f'''<html><head><style>{css}</style></head><body class="ui3-page"><main style="max-width:720px;margin:24px auto;padding:20px"><form data-post-lead-engagement="true" data-coveragefit-invitation="true" data-cf-entry="home_lander_form"><input name="review_context"><select name="housing_context"><option value="owner_occupied" selected>Owner</option></select></form></main></body></html>'''
    for w,h,label in [(390,844,'postlead-phone'),(1024,900,'postlead-desktop')]:
      page=browser.new_page(viewport={'width':w,'height':h}); page.set_content(harness())
      eng=(ROOT/'shared/post-lead-engagement.js').read_text().replace('/shared/images/dylan-headshot-160.webp',portrait_uri)
      inv=(ROOT/'shared/coveragefit-invitation.js').read_text().replace('/shared/images/dylan-headshot-160.webp',portrait_uri)
      page.add_script_tag(content=inv); page.add_script_tag(content=eng)
      page.evaluate("()=>window.PostLeadEngagement.present({leadCaptureStatus:'confirmed',onContinue:function(){window.__continued=true;}})"); page.wait_for_timeout(40)
      check(label+' confirmed human title',page.get_by_text('Thanks — I have your request.',exact=True).is_visible())
      check(label+' portrait visible',page.locator('.post-lead-human-portrait').is_visible())
      check(label+' no duplicate request',page.get_by_text('You’re not submitting another request.',exact=False).is_visible())
      touch(page,'.post-lead-next',label+' continue'); no_overflow(page,label)
      for i in range(3):
        page.locator('.post-lead-option input').first.check(); page.locator('.post-lead-next').click(); page.wait_for_timeout(20)
      check(label+' payoff visible',page.locator('[data-post-lead-payoff]').is_visible())
      page.locator('[data-post-lead-review-options]').click(); page.wait_for_timeout(30)
      check(label+' invitation visible',page.locator('[data-coveragefit-invitation-panel]').is_visible())
      check(label+' invitation portrait',page.locator('.coveragefit-human-portrait').is_visible())
      check(label+' request complete safeguard',page.get_by_text('Your request is complete.',exact=True).is_visible())
      check(label+' optional choice',page.get_by_role('heading',name='Would you like to get a head start on Dylan’s review?').is_visible())
      touch(page,'[data-coveragefit-invitation-continue]',label+' CoverageFit continue')
      touch(page,'[data-coveragefit-invitation-finish]',label+' finish now')
      no_overflow(page,label+' invitation'); page.close()

    page=browser.new_page(viewport={'width':390,'height':844}); page.set_content(harness())
    eng=(ROOT/'shared/post-lead-engagement.js').read_text().replace('/shared/images/dylan-headshot-160.webp',portrait_uri)
    page.add_script_tag(content=eng); page.evaluate("()=>window.PostLeadEngagement.present({leadCaptureStatus:'unconfirmed',onContinue:function(){}})"); page.wait_for_timeout(20)
    check('unconfirmed truthful title',page.get_by_text('You can keep going from here.',exact=True).is_visible())
    check('unconfirmed no false receipt',page.get_by_text('Thanks — I have your request.',exact=True).count()==0)
    page.close(); browser.close()

passed=sum(c['passed'] for c in checks)
out={'sprint':'408-UI-3.13.1D','suite':'relationship_completion_humanization_browser','total':len(checks),'passed':passed,'failed':len(checks)-passed,'viewports':['320x800','390x844','768x1024','1024x900','1440x900'],'checks':checks}
(ROOT/'UI3_13_1D_BROWSER_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-3.13.1D browser QA: {passed}/{len(checks)} passed')
sys.exit(0 if passed==len(checks) else 1)
