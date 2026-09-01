#!/usr/bin/env python3
from pathlib import Path
from collections import Counter
import hashlib,json,re,sys
from urllib.parse import urlsplit
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]
BASE=Path('/mnt/data/ui33_baseline')
checks=[]
def check(name,cond):
    checks.append({'name':name,'passed':bool(cond)})
    if not cond: print('FAIL',name)
def read(p): return p.read_text(errors='ignore')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def norm(node): return re.sub(r'>\s+<','><',str(node).strip())

check('home conversion css exists',(ROOT/'shared/home-conversion-ui.css').exists())
check('sprint doc exists',(ROOT/'SPRINT-408-UI-3.3.md').exists())
check('contract exists',(ROOT/'UI3_3_HOME_CONVERSION_CONTRACT.json').exists())
check('roadmap exists',(ROOT/'408-UI-ROADMAP.md').exists())

new=BeautifulSoup(read(ROOT/'home/index.html'),'html.parser')
base=BeautifulSoup(read(BASE/'home/index.html'),'html.parser')
check('UI33 meta hook',new.find('meta',attrs={'name':'408farmers-ui-home','content':'408-UI-3.3'}) is not None)
check('UI33 css hook',len(new.find_all('link',href='/shared/home-conversion-ui.css?v=408-UI-3.3'))==1)
check('UI31 foundation retained',len(new.find_all('link',href='/shared/ui-3-foundation.css?v=408-UI-3.1'))==1 and len(new.find_all('script',src='/shared/ui-3-foundation.js?v=408-UI-3.1'))==1)
check('body UI33 hook',new.body and new.body.get('data-ui-home')=='408-UI-3.3')
check('one h1',len(new.find_all('h1'))==1)
check('home promise h1','Does Your Insurance' in new.find('h1').get_text(' ',strip=True) and 'Still Fit Your Home?' in new.find('h1').get_text(' ',strip=True))
check('main landmark',new.find('main',id='main-content') is not None)
check('skip link',new.find('a',class_='skip-link',href='#main-content') is not None)
check('coverage review anchor',new.find(id='coverage-review') is not None)
check('lead form preserved',new.find('form',id='leadForm') is not None)

# Behavior-critical form contract must remain structurally unchanged.
nf=new.find('form',id='leadForm'); bf=base.find('form',id='leadForm')
for attr in ['action','method','data-cf-assessment','data-cf-entry','data-cf-extra-launch-surface','data-cf-next','data-cf-branch-field','data-cf-renter-destination','data-success','data-sender-build','data-handoff-contract','data-home-journey-contract','data-form-first-build']:
    check('form attr '+attr,nf.get(attr)==bf.get(attr))
new_names=Counter(x.get('name') for x in nf.find_all(['input','select','textarea']) if x.get('name'))
base_names=Counter(x.get('name') for x in bf.find_all(['input','select','textarea']) if x.get('name'))
check('form field-name inventory unchanged',new_names==base_names)
check('form field-name count >= 30',sum(new_names.values())>=30)
for name in ['source','campaign','campaign_id','campaign_variant','campaign_zip','landing_page','utm_source','utm_medium','utm_campaign','utm_content','utm_term','home_review_goal','housing_context','review_timing','first_name','last_name','phone','email','property_address','review_context','consent']:
    check('field preserved '+name,new_names[name]>=1)
for radio in ['engagement_home_review_goal','engagement_housing_context','engagement_review_timing']:
    check('engagement radio group '+radio,len(new.find_all('input',attrs={'name':radio,'type':'radio'}))==len(base.find_all('input',attrs={'name':radio,'type':'radio'})) and len(new.find_all('input',attrs={'name':radio,'type':'radio'}))>=4)

# Source destinations/scripts preserved exactly; UI hooks only add CSS/meta/body data.
check('all hrefs preserved',Counter(a.get('href') for a in new.find_all('a',href=True))==Counter(a.get('href') for a in base.find_all('a',href=True)))
check('runtime script inventory unchanged',Counter(s.get('src') for s in new.find_all('script',src=True))==Counter(s.get('src') for s in base.find_all('script',src=True)))
for src in ['/shared/home-lead-progressive.js?v=408-HOME-2.9-submitfix1','/shared/home-form-first.js?v=408-FLOW-2.2','/shared/post-lead-engagement.js?v=408-FLOW-2.3','/shared/coveragefit-invitation.js?v=408-CF-RPT-1.1','/shared/script.js?v=408-HOME-2.9-submitfix1']:
    check('runtime script '+src,new.find('script',src=src) is not None)

# Every public HTML surface other than Home remains byte-identical to UI-3.2.
public_base=[p for p in BASE.rglob('*.html') if not p.relative_to(BASE).as_posix().startswith(('qa/fixtures/','life-ops/'))]
check('public baseline html count >=26',len(public_base)>=26)
for b in public_base:
    rel=b.relative_to(BASE)
    if rel.as_posix()=='home/index.html': continue
    a=ROOT/rel
    check(f'{rel}:still exists',a.exists())
    if a.exists(): check(f'{rel}:byte-identical UI32',sha(a)==sha(b))

# Protected runtime must remain byte-identical to the UI-3.2 baseline.
protected=[
'_worker.js','shared/ui-3-foundation.css','shared/ui-3-foundation.js','shared/home-lead-progressive.js',
'shared/home-form-first.js','shared/home-engagement.js','shared/home-baseline.js','shared/home-continuity.js',
'shared/home-journey-contract.js','shared/home-certification.js','shared/post-lead-engagement.js',
'shared/coveragefit-invitation.js','shared/script.js','shared/config.js','shared/flyer-campaign.js',
'shared/coveragefit-launch.js','shared/prospect-profile.js','shared/address-autocomplete.js',
'shared/local-attribution.js','shared/life-secure-submit.js','shared/buyer-flow.js','shared/buyer-referral.js',
'local/data/catalog.json','local/pilot/pilot-launch.json','local/pilot/stevies-qr-campaigns.json'
]
for rel in protected:
    a=ROOT/rel;b=BASE/rel
    check(rel+':present',a.exists() and b.exists())
    if a.exists() and b.exists(): check(rel+':byte-identical',sha(a)==sha(b))

# New design layer contract.
css=read(ROOT/'shared/home-conversion-ui.css')
for token in ['var(--ui3-navy-950)','var(--ui3-red)','var(--ui3-white)','var(--ui3-line)','var(--ui3-soft)','var(--ui3-soft-blue)']:
    check('home CSS token '+token,token in css)
for selector in ['.home-flyer-hero','.home-review-section','.home-quote-card','.home-engagement-option','.home-payoff','.home-lead-step','.post-lead-receipt','.coveragefit-invitation-option','.steps','.agent-section']:
    check('home CSS selector '+selector,selector in css)
check('desktop split hero','grid-template-areas:"content image"' in css)
check('mobile stacked hero','grid-template-areas:"content" "image"' in css)
check('Farmers red progress','background:var(--ui3-red)!important' in css)
check('selected options use red','border-color:var(--ui3-red)!important' in css)
check('no giant headline',re.search(r'font-size\s*:\s*(?:7(?:\.\d+)?|8(?:\.\d+)?|9(?:\.\d+)?)rem',css) is None)
check('phone breakpoint','@media(max-width:520px)' in css)
check('tablet breakpoint','@media(max-width:980px)' in css)
check('short landscape support','max-height:520px' in css)
check('reduced motion support','prefers-reduced-motion' in css)
check('forced colors support','forced-colors:active' in css)

# Deep-entry routing still resolves to canonical Home asset.
worker=read(ROOT/'_worker.js')
check('QR deep routes still Home asset',"path.startsWith('/home/qr/')" in worker and "return { asset: '/home/' }" in worker)
check('campaign deep routes still Home asset',"path.startsWith('/home/campaign/')" in worker)

# Internal link integrity across public HTML.
public=[p for p in ROOT.rglob('*.html') if not p.relative_to(ROOT).as_posix().startswith(('qa/fixtures/','life-ops/'))]
broken=[];total=0
for p in public:
    soup=BeautifulSoup(read(p),'html.parser')
    for a in soup.find_all('a',href=True):
        href=a['href'].strip()
        if not href or href.startswith(('#','mailto:','tel:','sms:','javascript:','http://','https://')): continue
        path=urlsplit(href).path
        if not path: continue
        total+=1
        target=ROOT/path.lstrip('/') if path.startswith('/') else (p.parent/path).resolve()
        candidates=[target]
        if path.endswith('/') or target.is_dir(): candidates.append(target/'index.html')
        elif target.suffix=='': candidates.extend([Path(str(target)+'.html'),target/'index.html'])
        if not any(c.exists() for c in candidates): broken.append((str(p.relative_to(ROOT)),href))
check('internal links checked >=120',total>=120)
check('internal links broken 0',len(broken)==0)

result={'sprint':'408-UI-3.3','suite':'source_contract','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'internal_links_checked':total,'broken_links':broken[:20],'checks':checks}
(ROOT/'UI3_3_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.3 QA: {result['passed']}/{result['total']} passed; internal links {total}, broken {len(broken)}")
sys.exit(1 if result['failed'] else 0)
