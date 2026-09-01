#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json,sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,cond):
    checks.append({'name':name,'passed':bool(cond)})
    if not cond: print('FAIL',name)

def inline_page(rel):
    soup=BeautifulSoup((ROOT/rel).read_text(),'html.parser')
    for script in soup.find_all('script'): script.decompose()
    # external CSS is not needed for message-match assertions
    for link in soup.find_all('link',rel='stylesheet'): link.decompose()
    return str(soup)

def text(page,sel):
    loc=page.locator(sel).first
    return loc.inner_text().strip() if loc.count() else ''

registry_js=(ROOT/'shared/campaign-entry-registry.js').read_text()
runtime_js=(ROOT/'shared/campaign-entry.js').read_text()

cases=[
  ('home organic','home/index.html','/home/','', '[data-home-campaign-title]','Does Your Insurance','false',''),
  ('home coaster','home/index.html','/home/','?utm_source=stevies&utm_medium=coaster&utm_campaign=south_bay_homeowner&utm_content=home_front','[data-home-campaign-title]','Own a Home in the South Bay?','true','stevies_coaster_home_front'),
  ('bundle organic','auto-bundle/index.html','/auto-bundle/','', '[data-campaign-entry-title]','Review Home + Auto Together.','false',''),
  ('bundle coaster','auto-bundle/index.html','/auto-bundle/','?utm_source=stevies&utm_medium=coaster&utm_campaign=south_bay_homeowner&utm_content=bundle_back','[data-campaign-entry-title]','Own the Home. Drive the Cars.','true','stevies_coaster_bundle_back'),
  ('tech campaign','tech/index.html','/tech/','?campaign_id=occupation_tech_meta_v1&utm_source=meta&utm_medium=paid_social','[data-campaign-entry-title]','Work in Tech?','true','occupation_tech_meta_v1'),
  ('teacher organic','teachers/index.html','/teachers/','', '[data-campaign-entry-title]','Are You a Teacher?','false',''),
  ('teacher campaign','teachers/index.html','/teachers/','?campaign_id=occupation_teacher_meta_v1','[data-campaign-entry-title]','Are You a Teacher?','true','occupation_teacher_meta_v1'),
  ('engineer campaign','engineers/index.html','/engineers/','?utm_content=engineer_v1','[data-campaign-entry-title]','Are You an Engineer?','true','occupation_engineer_meta_v1'),
  ('health campaign','healthcare/index.html','/healthcare/','?utm_content=healthcare_v1','[data-campaign-entry-title]','Work in Healthcare?','true','occupation_healthcare_meta_v1'),
  ('buyer organic','buyer/index.html','/buyer/','', '[data-campaign-entry-title]','Buying a Home?','false',''),
  ('buyer partner','buyer/index.html','/buyer/','?partner_id=southbay-realty&partner_name=South%20Bay%20Realty','[data-campaign-entry-title]','Need Coverage for Your Closing?','true','realtor_buyer_card'),
  ('unknown fallback','tech/index.html','/tech/','?campaign_id=whatever123','[data-campaign-entry-title]','Work in Tech?','false','')
]

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1280,'height':900})
    for name,rel,path,search,sel,expected,active,entry_id in cases:
        page.set_content(inline_page(rel),wait_until='load')
        page.add_script_tag(content=registry_js)
        page.evaluate("""({path,search})=>{const base=window.Farmers408CampaignEntryRegistry;const ctx=base.resolve({pathname:path,search:search});window.Farmers408CampaignEntryRegistry=Object.assign({},base,{resolve:function(){return ctx;}})}""",{'path':path,'search':search})
        page.add_script_tag(content=runtime_js)
        page.wait_for_timeout(30)
        actual=text(page,sel)
        check(name+' copy',expected in actual)
        check(name+' active',page.locator('body').get_attribute('data-campaign-entry-active')==active)
        if entry_id: check(name+' id',page.locator('body').get_attribute('data-campaign-entry-id')==entry_id)
        check(name+' one h1',page.locator('h1').count()==1)

    # Campaign-specific CTA/form labels.
    def campaign_page(rel,path,search):
        page.set_content(inline_page(rel),wait_until='load');page.add_script_tag(content=registry_js)
        page.evaluate("""({path,search})=>{const base=window.Farmers408CampaignEntryRegistry;const ctx=base.resolve({pathname:path,search:search});window.Farmers408CampaignEntryRegistry=Object.assign({},base,{resolve:function(){return ctx;}})}""",{'path':path,'search':search})
        page.add_script_tag(content=runtime_js);page.wait_for_timeout(20)
    campaign_page('auto-bundle/index.html','/auto-bundle/','?utm_source=stevies&utm_medium=coaster&utm_content=bundle_back')
    check('bundle campaign submit',text(page,'[data-campaign-entry-submit]')=='Start My Home + Auto Review')
    campaign_page('teachers/index.html','/teachers/','?campaign_id=occupation_teacher_meta_v1')
    check('teacher campaign submit',text(page,'[data-campaign-entry-submit]')=='Check My Eligibility')
    campaign_page('buyer/index.html','/buyer/','?campaign_id=realtor_buyer_card')
    check('buyer campaign CTA',text(page,'[data-campaign-entry-start-online]')=='Start My Buyer Review')

    # Life and dynamic flyer are deliberately delegated to already-certified route-specific renderers.
    page.set_content(inline_page('life/index.html'),wait_until='load');page.add_script_tag(content=registry_js)
    page.evaluate("""()=>{const base=window.Farmers408CampaignEntryRegistry;const ctx=base.resolve({pathname:'/life/',search:'?campaign_variant=this_is_the_time'});window.Farmers408CampaignEntryRegistry=Object.assign({},base,{resolve:function(){return ctx;}})}""")
    page.add_script_tag(content=runtime_js);page.wait_for_timeout(20)
    check('life registry entry',page.locator('body').get_attribute('data-campaign-entry-id')=='life_this_is_the_time')
    check('life campaign visual mode',page.locator('body').get_attribute('data-campaign-visual-mode')=='life_campaign')
    check('life delegated leaves certified hero unchanged','Before' in text(page,'[data-life-hero-title]'))

    page.set_content(inline_page('home/index.html'),wait_until='load');page.add_script_tag(content=registry_js)
    page.evaluate("""()=>{const base=window.Farmers408CampaignEntryRegistry;const ctx=base.resolve({pathname:'/home/qr/95118/rate/',search:''});window.Farmers408CampaignEntryRegistry=Object.assign({},base,{resolve:function(){return ctx;}})}""")
    page.add_script_tag(content=runtime_js);page.wait_for_timeout(20)
    check('flyer delegated entry',page.locator('body').get_attribute('data-campaign-entry-id')=='home_flyer_dynamic')
    check('flyer delegated leaves base copy for existing flyer renderer','Does Your Insurance' in text(page,'[data-home-campaign-title]'))

    browser.close()
failed=[x for x in checks if not x['passed']]
result={'sprint':'408-UI-3.11.1','suite':'browser_message_match','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(ROOT/'UI3_11_1_BROWSER_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.11.1 Browser QA: {result['passed']}/{result['total']} passed")
sys.exit(1 if failed else 0)
