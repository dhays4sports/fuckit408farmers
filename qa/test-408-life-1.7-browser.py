#!/usr/bin/env python3
import json, os, pathlib, re
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parent.parent
CHROMIUM=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
checks=[]
def check(name,value): assert value,name; checks.append(name)

def clean_html(rel):
    s=(ROOT/rel).read_text()
    s=re.sub(r'<link[^>]+rel="stylesheet"[^>]*>','',s,flags=re.I)
    s=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',s,flags=re.I)
    return s

def add_styles(page,*files):
    for f in files: page.add_style_tag(content=(ROOT/f).read_text())

def install_fetch_mock(page):
    page.evaluate("""
      window.__lifeFetchCalls=[];
      window.fetch=async function(url,options){
        var u=String(url), body=options&&options.body?String(options.body):'';
        window.__lifeFetchCalls.push({url:u,body:body});
        if(u.indexOf('/api/life/application-init')>=0) return new Response(JSON.stringify({ok:true}),{status:202,headers:{'Content-Type':'application/json'}});
        if(u.indexOf('/api/life/conversion')>=0) return new Response(JSON.stringify({ok:true}),{status:202,headers:{'Content-Type':'application/json'}});
        if(u.indexOf('/api/life/producer/queue')>=0) return new Response(JSON.stringify({ok:true,producer:'producer@example.com',items:[]}),{status:200,headers:{'Content-Type':'application/json'}});
        if(u.indexOf('/api/life/producer/conversions')>=0) return new Response(JSON.stringify({ok:true,funnel:{totals:{landing_view:10,start_clicked:7,quick_questions_complete:5,application_details_started:4,application_start_submitted:2,rates:{landing_to_submission:.2}},creatives:{A:{landing_view:10,application_start_submitted:2,rates:{landing_to_submission:.2}}}}}),{status:200,headers:{'Content-Type':'application/json'}});
        if(u.indexOf('/api/life/producer/readiness')>=0) return new Response(JSON.stringify({ok:true,ready:true,checks:{assets_binding:true,queue_db_binding:true,queue_schema:true,encryption_key:true,allowed_origin:true,access_team_domain:true,access_audience:true,producer_allowlist:true}}),{status:200,headers:{'Content-Type':'application/json'}});
        return new Response(JSON.stringify({ok:false}),{status:404,headers:{'Content-Type':'application/json'}});
      };
    """)

def add_script(page,rel): page.add_script_tag(content=(ROOT/rel).read_text())

with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(clean_html('life/index.html'),wait_until='load');add_styles(page,'shared/styles.css','shared/life.css','shared/accessibility.css');install_fetch_mock(page)
  for js in ['shared/life-campaign.js','shared/life-conversion.js','shared/life-intake.js','shared/life-secure-submit.js']: add_script(page,js)
  page.wait_for_function("document.body.dataset.lifeCampaignMatchingReady==='true' && document.body.dataset.lifeConversionReady==='true'")
  title=' '.join(page.locator('[data-life-hero-title]').inner_text().split())
  check('Default rendered hero is Creative A','before anything changes' in title.lower());check('Default creative code is A',page.locator('body').get_attribute('data-life-creative-code')=='A');check('LIFE has no mobile horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'));check('LIFE rendered runtime has no exception',not errors)
  page.locator('[data-life-start]').click();page.check('input[name="protection_priority"][value="family_income"]');page.locator('[data-life-step="1"] [data-life-next]').click();page.check('input[name="income_runway"][value="3_to_6_months"]');page.locator('[data-life-step="2"] [data-life-next]').click();page.check('input[name="existing_life_coverage"][value="work"]');page.locator('[data-life-step="3"] [data-life-next]').click();page.locator('[data-life-application-start]').click();page.fill('input[name="first_name"]','Test');page.fill('input[name="last_name"]','Applicant');page.check('input[name="gender"][value="female"]');page.fill('input[name="date_of_birth"]','1990-01-15');page.locator('[data-life-step="4"] [data-life-next]').click();page.fill('input[name="residential_address"]','123 Main St');page.fill('input[name="residential_city"]','San Jose');page.fill('input[name="residential_state"]','CA');page.fill('input[name="residential_zip"]','95118');page.fill('input[name="email"]','test@example.com');page.fill('input[name="phone"]','4085551212');page.locator('[data-life-step="5"] [data-life-next]').click();page.fill('input[name="ssn_last4"]','0042');page.check('input[name="application_acknowledgement"]');page.locator('[data-life-secure-submit]').click();page.wait_for_timeout(200)
  calls=page.evaluate('window.__lifeFetchCalls');conv=[];app=None
  for c in calls:
    if '/api/life/conversion' in c['url']:
      try:conv.append(json.loads(c['body']))
      except:pass
    if '/api/life/application-init' in c['url']:
      try:app=json.loads(c['body'])
      except:pass
  names=[x.get('event_name') for x in conv]
  for event in ['landing_view','start_clicked','quick_questions_complete','application_details_started','application_start_submitted']:check(f'Journey emits {event}',event in names)
  check('Conversion events are deduplicated in browser',len(set(names))==len(names));serialized=json.dumps(conv);check('Conversion payloads contain no applicant identity or answers',all(x not in serialized for x in ['test@example.com','0042','123 Main St','family_income','3_to_6_months','1990-01-15','4085551212']));expected=['attribution','event_id','event_name','journey_id','schema_version'];check('Conversion payloads contain only expected top-level keys',all(sorted(x.keys())==expected for x in conv));check('Application payload reaches secure endpoint',app and app['applicant']['ssn_last4']=='0042' and app['applicant']['email']=='test@example.com' and app['attribution']['creative_code']=='A');check('LIFE journey creates no local/session storage',page.evaluate("(()=>{try{return localStorage.length===0&&sessionStorage.length===0}catch(e){return true}})()"));check('LIFE network calls stay on dedicated API paths',all(c['url'].startswith('/api/life/') for c in calls if c['url']!='null'));ctx.close()

  ctx=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');page=ctx.new_page();page.set_content(clean_html('life-ops/index.html'),wait_until='load');add_styles(page,'shared/styles.css','shared/life-ops.css','shared/accessibility.css');install_fetch_mock(page);add_script(page,'shared/life-ops.js');page.wait_for_function("document.querySelector('[data-life-readiness]')?.getAttribute('data-ready')==='true'")
  check('Producer readiness renders ready state','Ready for paid LIFE traffic' in page.locator('[data-life-readiness-label]').inner_text());check('Producer funnel renders submission count',page.locator('[data-life-funnel="application_start_submitted"]').inner_text()=='2');check('Producer funnel renders conversion rate',page.locator('[data-life-funnel-rate]').inner_text()=='20%');check('Producer workspace has no mobile overflow',page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'));ctx.close();browser.close()

report={'sprint':'408-LIFE-1.7-browser','passed':len(checks),'failed':0,'checks':checks};(ROOT/'LIFE1_7_BROWSER_QA.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
