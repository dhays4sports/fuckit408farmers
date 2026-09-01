#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json,sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)
def inline(rel):
    s=BeautifulSoup((ROOT/rel).read_text(),'html.parser')
    for sc in s.find_all('script'): sc.decompose()
    for l in s.find_all('link',rel='stylesheet'): l.decompose()
    return str(s)
def txt(page,sel):
    loc=page.locator(sel).first
    return loc.inner_text().strip() if loc.count() else ''
reg=(ROOT/'shared/campaign-entry-registry.js').read_text()
runtime=(ROOT/'shared/campaign-entry.js').read_text()
flyer=(ROOT/'shared/flyer-campaign.js').read_text()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    # New organic copy remains the UI-4 editorial baseline.
    pg.set_content(inline('home/index.html'),wait_until='load'); pg.add_script_tag(content=reg)
    pg.evaluate("()=>{const base=window.Farmers408CampaignEntryRegistry;const ctx=base.resolve({pathname:'/home/',search:''});window.Farmers408CampaignEntryRegistry=Object.assign({},base,{resolve:()=>ctx})}")
    pg.add_script_tag(content=runtime); pg.wait_for_timeout(20)
    check('home organic inactive',pg.locator('body').get_attribute('data-campaign-entry-active')=='false')
    check('home organic editorial copy','Start with a' in txt(pg,'[data-home-campaign-title]') and 'home coverage review.' in txt(pg,'[data-home-campaign-title]'))
    # Coaster campaign takes over the same nodes.
    pg.set_content(inline('home/index.html'),wait_until='load'); pg.add_script_tag(content=reg)
    pg.evaluate("()=>{const base=window.Farmers408CampaignEntryRegistry;const ctx=base.resolve({pathname:'/home/',search:'?utm_source=stevies&utm_medium=coaster&utm_campaign=south_bay_homeowner&utm_content=home_front'});window.Farmers408CampaignEntryRegistry=Object.assign({},base,{resolve:()=>ctx})}")
    pg.add_script_tag(content=runtime); pg.wait_for_timeout(20)
    check('home coaster matched',txt(pg,'[data-home-campaign-title]')=='Own a Home in the South Bay?')
    check('home coaster id',pg.locator('body').get_attribute('data-campaign-entry-id')=='stevies_coaster_home_front')
    # Flyer remains delegated to the existing specialized renderer and still replaces UI-4 organic copy.
    pg.set_content(inline('home/index.html'),wait_until='load'); pg.add_script_tag(content=reg)
    pg.evaluate("()=>{const base=window.Farmers408CampaignEntryRegistry;const ctx=base.resolve({pathname:'/home/qr/95118/rate/',search:''});window.Farmers408CampaignEntryRegistry=Object.assign({},base,{resolve:()=>ctx})}")
    pg.add_script_tag(content=runtime); pg.add_script_tag(content=flyer); pg.wait_for_timeout(20)
    # Directly invoke the already-certified flyer renderer against the explicit route context.
    pg.evaluate("()=>{if(window.Farmers408FlyerCampaign){const c=window.Farmers408FlyerCampaign.readLocation({pathname:'/home/qr/95118/rate/',search:''});window.Farmers408FlyerCampaign.render(c)}}")
    check('home flyer title','We Recently Found a Competitive Farmers Rate in 95118.'==txt(pg,'[data-home-campaign-title]'))
    # Bundle organic copy and coaster override.
    pg.set_content(inline('auto-bundle/index.html'),wait_until='load'); pg.add_script_tag(content=reg)
    pg.evaluate("()=>{const base=window.Farmers408CampaignEntryRegistry;const ctx=base.resolve({pathname:'/auto-bundle/',search:''});window.Farmers408CampaignEntryRegistry=Object.assign({},base,{resolve:()=>ctx})}")
    pg.add_script_tag(content=runtime); pg.wait_for_timeout(20)
    check('bundle organic inactive',pg.locator('body').get_attribute('data-campaign-entry-active')=='false')
    check('bundle organic editorial copy','Let’s look at' in txt(pg,'[data-campaign-entry-title]') and 'home and auto together.' in txt(pg,'[data-campaign-entry-title]'))
    pg.set_content(inline('auto-bundle/index.html'),wait_until='load'); pg.add_script_tag(content=reg)
    pg.evaluate("()=>{const base=window.Farmers408CampaignEntryRegistry;const ctx=base.resolve({pathname:'/auto-bundle/',search:'?utm_source=stevies&utm_medium=coaster&utm_campaign=south_bay_homeowner&utm_content=bundle_back'});window.Farmers408CampaignEntryRegistry=Object.assign({},base,{resolve:()=>ctx})}")
    pg.add_script_tag(content=runtime); pg.wait_for_timeout(20)
    check('bundle coaster matched',txt(pg,'[data-campaign-entry-title]')=='Own the Home. Drive the Cars.')
    check('bundle coaster submit',txt(pg,'[data-campaign-entry-submit]')=='Start My Home + Auto Review')
    # Unknown current-entry values never become visible copy.
    pg.set_content(inline('home/index.html'),wait_until='load'); pg.add_script_tag(content=reg)
    pg.evaluate("()=>{const base=window.Farmers408CampaignEntryRegistry;const ctx=base.resolve({pathname:'/home/',search:'?campaign_id=%3Cscript%3Ebad%3C%2Fscript%3E'});window.Farmers408CampaignEntryRegistry=Object.assign({},base,{resolve:()=>ctx})}")
    pg.add_script_tag(content=runtime); pg.wait_for_timeout(20)
    check('unknown safe fallback',pg.locator('body').get_attribute('data-campaign-entry-active')=='false' and '<script>' not in txt(pg,'h1'))
    b.close()
passed=sum(x['passed'] for x in checks)
out={'sprint':'408-UI-4.3','suite':'home_bundle_campaign_continuity','total':len(checks),'passed':passed,'failed':len(checks)-passed,'checks':checks}
(ROOT/'UI4_3_CAMPAIGN_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-4.3 Campaign QA: {passed}/{len(checks)} passed')
sys.exit(0 if passed==len(checks) else 1)
