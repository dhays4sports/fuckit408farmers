#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import json, sys, urllib.parse

ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT/'local/data/catalog.json').read_text())
checks=[]

def check(name, cond, detail=''):
    ok=bool(cond); checks.append({'name':name,'passed':ok,'detail':detail if not ok else ''})
    if not ok: print('FAIL',name,detail)

def resolve_script(page_rel, src):
    src=src.split('?',1)[0]
    if src.startswith('/'):
        return ROOT/src.lstrip('/')
    return (ROOT/page_rel).parent/src

def load_page(page, rel, fetch_config=None):
    html=(ROOT/rel).read_text()
    soup=BeautifulSoup(html,'html.parser')
    scripts=[]
    for s in soup.find_all('script'):
        if s.get('src'): scripts.append(('src',s.get('src')))
        else: scripts.append(('inline',s.string or s.text or ''))
        s.decompose()
    # Avoid meaningless about:blank network noise; layout is certified separately.
    for link in list(soup.find_all('link')):
        rels=(link.attrs or {}).get('rel') or []
        if 'stylesheet' in rels: link.decompose()
    page.set_content(str(soup),wait_until='load')
    cfg={'proxy_status':200,'direct_status':200,'life_status':200,'join_status':200,'local_event_status':200}
    if fetch_config: cfg.update(fetch_config)
    mock = f'''(()=>{{
      window.__mockRequests=[];
      window.__mockFetchConfig={json.dumps(cfg)};
      const catalog={json.dumps(CATALOG)};
      window.fetch=async function(url,opts){{
        opts=opts||{{}}; const u=String(url); let data=null;
        try {{ if(opts.body instanceof FormData) data=Object.fromEntries(opts.body.entries()); else if(typeof opts.body==='string') data=opts.body; }} catch(e){{}}
        window.__mockRequests.push({{url:u,method:opts.method||'GET',data:data}});
        if(u.indexOf('/local/data/catalog.json')>=0) return new Response(JSON.stringify(catalog),{{status:200,headers:{{'Content-Type':'application/json'}}}});
        if(u.indexOf('/api/lead')>=0) {{ const s=window.__mockFetchConfig.proxy_status; return new Response(JSON.stringify({{ok:s<400}}),{{status:s,headers:{{'Content-Type':'application/json'}}}}); }}
        if(u.indexOf('formspree.io/')>=0) {{ const s=window.__mockFetchConfig.direct_status; return new Response(JSON.stringify({{ok:s<400}}),{{status:s,headers:{{'Content-Type':'application/json'}}}}); }}
        if(u.indexOf('/api/life/application-init')>=0) {{ const s=window.__mockFetchConfig.life_status; return new Response(JSON.stringify({{ok:s<400}}),{{status:s,headers:{{'Content-Type':'application/json'}}}}); }}
        if(u.indexOf('/api/local/merchant-application')>=0) {{ const s=window.__mockFetchConfig.join_status; return new Response(JSON.stringify({{ok:s<400}}),{{status:s,headers:{{'Content-Type':'application/json'}}}}); }}
        if(u.indexOf('/api/local/event')>=0) {{ const s=window.__mockFetchConfig.local_event_status; return new Response(JSON.stringify({{ok:s<400}}),{{status:s,headers:{{'Content-Type':'application/json'}}}}); }}
        return new Response('',{{status:200}});
      }};
    }})();'''
    page.add_script_tag(content=mock)
    for kind,val in scripts:
        if kind=='inline':
            if val.strip(): page.add_script_tag(content=val)
        else:
            p=resolve_script(rel,val)
            if p.exists(): page.add_script_tag(content=p.read_text())
            else: check(f'{rel} script exists: {val}',False,str(p))
    page.wait_for_timeout(80)

def page_errors(page):
    errs=[]
    page.on('pageerror',lambda e: errs.append(str(e)))
    return errs

def setv(page, selector, value):
    page.eval_on_selector(selector,'(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));}',value)

def fill_lead(page):
    for name,value in [('first_name','Regression'),('last_name','Tester'),('phone','4085551212'),('email','regression@example.com')]:
        setv(page,f'#leadForm [name="{name}"]',value)
    if page.locator('#leadForm [name="property_address"]').count(): setv(page,'#leadForm [name="property_address"]','123 Test St, San Jose, CA 95118')
    for name in ['review_context','initial_housing_context','housing_context','occupancy','occupation_segment']:
        loc=page.locator(f'#leadForm [name="{name}"]')
        if loc.count():
            vals=loc.locator('option').evaluate_all('(els)=>els.map(e=>e.value).filter(Boolean)')
            if vals: setv(page,f'#leadForm [name="{name}"]',vals[0])
    if page.locator('#leadForm [name="closing_date"]').count(): setv(page,'#leadForm [name="closing_date"]','2026-09-15')
    if page.locator('#leadForm [name="consent"]').count(): page.eval_on_selector('#leadForm [name="consent"]','el=>{el.checked=true;el.dispatchEvent(new Event("change",{bubbles:true}))}')
    page.eval_on_selector('#leadForm button[type="submit"]','el=>el.disabled=false')

def submit_lead(page):
    # Certified Home-family forms may use a progressive/form-first submit gate.
    # Advance until the first real transport occurs, then stop so the post-lead
    # state is exercised exactly once.
    for _ in range(4):
        page.evaluate("document.getElementById('leadForm').requestSubmit()")
        page.wait_for_timeout(140)
        urls=request_urls(page)
        if any('/api/lead' in u or 'formspree.io/' in u for u in urls):
            break
    page.wait_for_function("()=>{const p=document.querySelector('[data-post-lead-engagement-panel]');return p && !p.hidden;}",timeout=4000)

def request_urls(page): return page.evaluate('window.__mockRequests.map(r=>r.url)')

def request_records(page): return page.evaluate('window.__mockRequests')

def answer_postlead(page):
    for _ in range(3):
        page.evaluate("()=>{const r=document.querySelector('[data-post-lead-question-form] input[type=\"radio\"]');r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-post-lead-next]').click();}")
        page.wait_for_timeout(20)
    page.evaluate("()=>document.querySelector('[data-post-lead-review-options]').click()")
    page.locator('[data-coveragefit-invitation-panel]').wait_for(state='visible',timeout=3000)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])

    # Homepage routing contract.
    page=browser.new_page(); errs=page_errors(page); load_page(page,'index.html')
    text=page.locator('body').inner_text()
    check('homepage identity','Insurance That Fits' in text)
    for href in ['/home/','/auto-bundle/','/buyer/','/life/','/local/']:
        check('homepage route '+href,page.locator(f'a[href="{href}"]').count()>0)
    check('homepage runtime clean',not errs,'; '.join(errs)); page.close()

    # Home end-to-end confirmed submission and explicit CoverageFit continuation.
    page=browser.new_page(); errs=page_errors(page); load_page(page,'home/index.html')
    fill_lead(page); submit_lead(page)
    check('home proxy called','/api/lead' in ' '.join(request_urls(page)))
    check('home post-lead visible',page.evaluate("()=>!document.querySelector('[data-post-lead-engagement-panel]').hidden"))
    answer_postlead(page)
    page.evaluate('''()=>{const real=window.CoverageFitLauncher; real.launch=(opts)=>{window.__cfOpts=opts; const u=new URL('https://coveragefit.com/transition/'); real.appendProfileParams(u,opts.profile||{}); window.__cfPrefill=u.toString(); return u.toString();};}''')
    page.evaluate("()=>document.querySelector('[data-coveragefit-invitation-continue]').click()"); page.wait_for_timeout(30)
    cfopts=page.evaluate('window.__cfOpts||null')
    cfprefill=page.evaluate('window.__cfPrefill||""')
    check('home explicit CoverageFit launch',cfopts is not None,str(cfopts))
    check('home prefill preserved','first_name=Regression' in cfprefill,cfprefill)
    check('home consent preserved',cfopts and cfopts.get('extra',{}).get('contact_consent')=='true',str(cfopts))
    check('home assessment route',cfopts and cfopts.get('next')=='/assessment/',str(cfopts))
    check('home runtime clean',not errs,'; '.join(errs)); page.close()

    # Home transport failover: proxy failure -> direct Formspree success.
    page=browser.new_page(); errs=page_errors(page); load_page(page,'home/index.html',{'proxy_status':500,'direct_status':200}); fill_lead(page); submit_lead(page)
    urls=request_urls(page)
    check('home failover proxy attempted',any('/api/lead' in u for u in urls))
    check('home failover Formspree attempted',any('formspree.io/' in u for u in urls))
    check('home failover still confirms',page.evaluate("()=>!document.querySelector('[data-post-lead-engagement-panel]').hidden"))
    check('home failover runtime clean',not errs,'; '.join(errs)); page.close()

    # Home + Auto, Buyer, and all four Professional Programs submit through the same hard-gated lead path.
    routes=['auto-bundle/index.html','buyer/index.html','tech/index.html','teachers/index.html','engineers/index.html','healthcare/index.html']
    for rel in routes:
        page=browser.new_page(); errs=page_errors(page); load_page(page,rel); fill_lead(page); submit_lead(page)
        tag=rel.split('/')[0]
        check(tag+' lead proxy called',any('/api/lead' in u for u in request_urls(page)))
        check(tag+' post-lead visible',page.evaluate("()=>!document.querySelector('[data-post-lead-engagement-panel]').hidden"))
        check(tag+' runtime clean',not errs,'; '.join(errs)); page.close()

    # Buyer attribution parser remains bounded and produces partner-aware campaign values.
    page=browser.new_page(); load_page(page,'buyer/index.html')
    buyer=page.evaluate('''()=>window.Farmers408BuyerReferral ? window.Farmers408BuyerReferral.resolve('?partner_id=South%20Bay%20Realty&partner_name=South%20Bay%20Realty&utm_medium=qr') : null''')
    check('buyer referral parser available',buyer is not None)
    if buyer:
        check('buyer partner normalized',buyer.get('partnerId')=='south-bay-realty',str(buyer))
        check('buyer referral source',buyer.get('referralSource')=='realtor_partner',str(buyer))
        check('buyer campaign id bounded',str(buyer.get('campaignId','')).startswith('buyer_partner_'),str(buyer))
    page.close()

    # Secure Life application transport, privacy boundary, and completion event.
    page=browser.new_page(); errs=page_errors(page); load_page(page,'life/index.html')
    page.evaluate('''()=>{const f=document.querySelector('[data-life-intake-form]');
      f.querySelectorAll('[data-life-phase="application"] input').forEach(i=>i.disabled=false);
      const set=(n,v)=>{const e=f.elements[n];if(e)e.value=v;};
      f.querySelector('input[name="protection_priority"]').checked=true;
      f.querySelector('input[name="income_runway"]').checked=true;
      f.querySelector('input[name="existing_life_coverage"]').checked=true;
      set('first_name','Regression');set('last_name','Life');f.querySelector('input[name="gender"]').checked=true;
      set('date_of_birth','1990-01-15');set('residential_address','123 Test St');set('residential_city','San Jose');set('residential_state','CA');set('residential_zip','95118');set('email','life@example.com');set('phone','4085551212');set('ssn_last4','1234');
      f.querySelector('input[name="application_acknowledgement"]').checked=true;
      f.querySelector('[data-life-secure-submit]').disabled=false;
      window.__lifeComplete=false;document.addEventListener('life:secure-submission-complete',()=>window.__lifeComplete=true,{once:true});
    }''')
    page.evaluate("()=>document.querySelector('[data-life-secure-submit]').click()"); page.wait_for_timeout(120)
    reqs=request_records(page); life=[r for r in reqs if '/api/life/application-init' in r['url']]
    check('life secure endpoint called',len(life)==1,str(reqs))
    check('life completion event',page.evaluate('window.__lifeComplete===true'))
    if life:
        body=life[0]['data'] if isinstance(life[0]['data'],str) else json.dumps(life[0]['data'])
        check('life schema sent','408-life-application-init-v1' in body,body)
        check('life last4 only','"ssn_last4":"1234"' in body and '123-45-' not in body,body)
    check('life runtime clean',not errs,'; '.join(errs)); page.close()

    # Local directory and real pilot merchant rendering/redemption.
    page=browser.new_page(); errs=page_errors(page); load_page(page,'local/index.html'); page.wait_for_timeout(120)
    check('Local directory ready',page.locator('[data-local-directory]').get_attribute('data-local-directory-state')=='ready')
    check('Local directory shows Stevie','Stevie' in page.locator('[data-local-directory-grid]').inner_text())
    check('Local directory runtime clean',not errs,'; '.join(errs)); page.close()

    page=browser.new_page(); errs=page_errors(page); load_page(page,'local/detail/index.html')
    # Replace the initial invalid about:blank result with the real Cloudflare pretty-path context.
    page.evaluate('''async()=>{window.LocalAttribution.saveContext({source:'local',surface:'merchant_qr',campaign:'local_perks',variant:'merchant_page'},{origin:'https://408farmers.com'});await window.LocalMerchant.initMerchantPage(document,{pathname:'/local/stevies-bar-grill/',search:'',href:'https://408farmers.com/local/stevies-bar-grill/'});}''')
    page.locator('[data-local-use-perk]').wait_for(state='visible',timeout=3000)
    check('Local merchant ready',page.locator('[data-local-merchant-detail]').get_attribute('data-local-detail-state')=='ready')
    check('Local perk independent','No insurance purchase or quote required' in page.locator('body').inner_text())
    page.locator('[data-local-use-perk]').click(force=True)
    check('Local redemption opens',page.locator('[data-local-redemption-dialog]').get_attribute('open') is not None)
    decorated=page.evaluate("window.LocalAttribution.decorateUrl('/home/',{}, {origin:'https://408farmers.com'})")
    check('Local insurance attribution decorates', 'source=local' in decorated and 'merchant_slug=stevies-bar-grill' in decorated,decorated)
    check('Local merchant runtime clean',not errs,'; '.join(errs)); page.close()

    # Merchant Join validation + proxy transport. Direct module call avoids about:blank navigation semantics.
    page=browser.new_page(); errs=page_errors(page); load_page(page,'local/join/index.html')
    page.evaluate('window.LocalMerchantJoin.mount(document,{search:"?utm_source=pilot_test",href:"https://408farmers.com/local/join/?utm_source=pilot_test"})')
    vals={'business_name':'Regression Cafe','business_location':'Willow Glen, San Jose','contact_name':'Test Merchant','email':'merchant@example.com','phone':'4085557878','proposed_perk':'Complimentary coffee with qualifying purchase.'}
    for n,v in vals.items(): page.locator(f'#localMerchantJoinForm [name="{n}"]').fill(v)
    page.locator('#localMerchantJoinForm [name="category"]').select_option('eat-drink')
    page.locator('#localMerchantJoinForm [name="authorized_ack"]').check();page.locator('#localMerchantJoinForm [name="separation_ack"]').check()
    valid=page.evaluate("window.LocalMerchantJoin.validateFormData(new FormData(document.getElementById('localMerchantJoinForm')))")
    check('merchant join validates',valid.get('ok') is True,str(valid))
    result=page.evaluate("window.LocalMerchantJoin.submitViaProxy(document.getElementById('localMerchantJoinForm'),window.fetch)")
    check('merchant join proxy confirms',result.get('ok') is True,str(result))
    check('merchant join endpoint called',any('/api/local/merchant-application' in u for u in request_urls(page)))
    check('merchant join runtime clean',not errs,'; '.join(errs)); page.close()

    # Campaign layer safety: current-entry only, unknown values fail evergreen, raw values are not HTML-injected.
    page=browser.new_page(); load_page(page,'tech/index.html')
    safety=page.evaluate('''()=>{const r=window.Farmers408CampaignEntryRegistry;return {unknown:r.resolve({pathname:'/tech/',search:'?campaign_id=%3Cscript%3Ebad%3C%2Fscript%3E'}),organic:r.resolve({pathname:'/tech/',search:''})};}''')
    check('unknown campaign inactive',safety['unknown'].get('active') is False,str(safety))
    check('organic campaign inactive',safety['organic'].get('active') is False,str(safety)); page.close()

    browser.close()

failed=[x for x in checks if not x['passed']]
result={'sprint':'408-UI-3.12','suite':'end_to_end_functional_regression','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(ROOT/'UI3_12_E2E_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.12 E2E QA: {result['passed']}/{result['total']} passed")
if failed:
    for x in failed: print('FAIL',x['name'],x['detail'])
sys.exit(1 if failed else 0)
