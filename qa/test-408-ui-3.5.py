#!/usr/bin/env python3
from pathlib import Path
from collections import Counter
import hashlib,json,re,sys
from urllib.parse import urlsplit
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]
BASE=Path('/mnt/data/ui35_baseline')
checks=[]
def check(name,cond):
    checks.append({'name':name,'passed':bool(cond)})
    if not cond: print('FAIL',name)
def read(p): return p.read_text(errors='ignore')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

check('buyer experience css exists',(ROOT/'shared/buyer-experience-ui.css').exists())
check('sprint doc exists',(ROOT/'SPRINT-408-UI-3.5.md').exists())
check('contract exists',(ROOT/'UI3_5_BUYER_EXPERIENCE_CONTRACT.json').exists())
check('roadmap exists',(ROOT/'408-UI-ROADMAP.md').exists())

new=BeautifulSoup(read(ROOT/'buyer/index.html'),'html.parser')
base=BeautifulSoup(read(BASE/'buyer/index.html'),'html.parser')
new_thanks=BeautifulSoup(read(ROOT/'buyer/thank-you.html'),'html.parser')
base_thanks=BeautifulSoup(read(BASE/'buyer/thank-you.html'),'html.parser')
check('UI35 meta hook',new.find('meta',attrs={'name':'408farmers-ui-buyer','content':'408-UI-3.5'}) is not None)
check('UI35 css hook',len(new.find_all('link',href='/shared/buyer-experience-ui.css?v=408-UI-3.5'))==1)
check('UI35 fallback css hook',len(new_thanks.find_all('link',href='/shared/buyer-experience-ui.css?v=408-UI-3.5'))==1)
check('UI31 foundation retained',len(new.find_all('link',href='/shared/ui-3-foundation.css?v=408-UI-3.1'))==1 and len(new.find_all('script',src='/shared/ui-3-foundation.js?v=408-UI-3.1'))==1)
check('body UI35 hook',new.body and new.body.get('data-ui-buyer')=='408-UI-3.5')
check('fallback body UI35 hook',new_thanks.body and new_thanks.body.get('data-ui-buyer')=='408-UI-3.5')
check('buyer route identity retained',new.find('h1') and new.find('h1').get_text(' ',strip=True)=='Buying a Home?')
check('closing-first lead',new.find(class_='buyer-hero-lead') and new.find(class_='buyer-hero-lead').get_text(' ',strip=True)=='Coverage that keeps up with your closing.')
check('main landmark',new.find('main',id='main-content') is not None)
check('skip link',new.find('a',class_='skip-link',href='#main-content') is not None)
check('lead form preserved',new.find('form',id='leadForm') is not None)
check('text-first choice preserved',new.find(attrs={'data-buyer-text-link':True}) is not None and 'Text Dylan at 408-FARMERS' in new.get_text(' ',strip=True))
check('online-start choice preserved',new.find(attrs={'data-buyer-start-online':True}) is not None and new.find(id='buyer-review') is not None)
check('referral acknowledgement retained',new.find(attrs={'data-buyer-referral':True}) is not None and new.find(attrs={'data-buyer-referral-name':True}) is not None)

nf=new.find('form',id='leadForm'); bf=base.find('form',id='leadForm')
for attr in ['action','method','data-coveragefit-after-submit','data-success','data-cf-assessment','data-cf-entry','data-cf-extra-launch-surface','data-cf-next','data-cf-branch-field','data-cf-renter-destination','data-sender-build','data-handoff-contract']:
    check('form attr '+attr,nf.get(attr)==bf.get(attr))
new_names=Counter(x.get('name') for x in nf.find_all(['input','select','textarea']) if x.get('name'))
base_names=Counter(x.get('name') for x in bf.find_all(['input','select','textarea']) if x.get('name'))
check('form field-name inventory unchanged',new_names==base_names)
for name in ['source','campaign','campaign_id','campaign_variant','campaign_zip','landing_page','submitted_at','utm_source','utm_medium','utm_campaign','utm_content','utm_term','review_context','partner_id','partner_name','partner_code','referral_source','closing_urgency','property_address','closing_date','occupancy','first_name','last_name','phone','email','consent']:
    check('field preserved '+name,new_names[name]>=1)
check('occupancy options unchanged',[o.get_text(' ',strip=True) for o in nf.select('select[name="occupancy"] option')]==[o.get_text(' ',strip=True) for o in bf.select('select[name="occupancy"] option')])
check('consent text unchanged',nf.find('label',class_='buyer-consent').get_text(' ',strip=True)==bf.find('label',class_='buyer-consent').get_text(' ',strip=True))
check('buyer step count unchanged',len(nf.select('[data-buyer-step]'))==len(bf.select('[data-buyer-step]'))==2)
check('buyer progress count unchanged',len(new.select('[data-buyer-progress]'))==len(base.select('[data-buyer-progress]'))==2)

# Hrefs and runtime script inventories remain exact on both buyer pages.
check('buyer href inventory unchanged',Counter(a.get('href') for a in new.find_all('a',href=True))==Counter(a.get('href') for a in base.find_all('a',href=True)))
check('buyer runtime script inventory unchanged',Counter(s.get('src') for s in new.find_all('script',src=True))==Counter(s.get('src') for s in base.find_all('script',src=True)))
check('fallback href inventory unchanged',Counter(a.get('href') for a in new_thanks.find_all('a',href=True))==Counter(a.get('href') for a in base_thanks.find_all('a',href=True)))
check('fallback runtime script inventory unchanged',Counter(s.get('src') for s in new_thanks.find_all('script',src=True))==Counter(s.get('src') for s in base_thanks.find_all('script',src=True)))
for src in ['../shared/config.js?v=408-BUY-1.1','../shared/flyer-campaign.js?v=408-NP-1.5','../shared/buyer-referral.js?v=408-RC-SMS-1.6','../shared/coveragefit-launch.js?v=408-BUY-1.1','../shared/prospect-profile.js?v=408-BUY-1.1','../shared/address-autocomplete.js?v=408-BUY-1.1','../shared/buyer-flow.js?v=408-RC-SMS-1.6','../shared/post-lead-engagement.js?v=408-FLOW-2.3','../shared/coveragefit-invitation.js?v=408-CF-RPT-1.1','../shared/script.js?v=408-BUY-1.1','/shared/ui-3-foundation.js?v=408-UI-3.1']:
    check('runtime script '+src,new.find('script',src=src) is not None)

# All other public HTML remains byte-identical to UI-3.4 baseline.
public_base=[p for p in BASE.rglob('*.html') if not p.relative_to(BASE).as_posix().startswith(('qa/fixtures/','life-ops/'))]
check('public baseline html count >=26',len(public_base)>=26)
for b in public_base:
    rel=b.relative_to(BASE)
    if rel.as_posix() in ('buyer/index.html','buyer/thank-you.html'): continue
    a=ROOT/rel
    check(f'{rel}:still exists',a.exists())
    if a.exists(): check(f'{rel}:byte-identical baseline',sha(a)==sha(b))

# Protected runtime stays byte-identical.
protected=[
'_worker.js','shared/ui-3-foundation.css','shared/ui-3-foundation.js','shared/home-conversion-ui.css','shared/auto-bundle-conversion-ui.css',
'shared/buyer.css','shared/buyer-flow.js','shared/buyer-referral.js','shared/address-autocomplete.js','shared/coveragefit-launch.js',
'shared/prospect-profile.js','shared/post-lead-engagement.js','shared/coveragefit-invitation.js','shared/script.js','shared/config.js',
'shared/local-attribution.js','shared/life-secure-submit.js','local/data/catalog.json','local/pilot/pilot-launch.json','local/pilot/stevies-qr-campaigns.json'
]
for rel in protected:
    a=ROOT/rel;b=BASE/rel
    check(rel+':present',a.exists() and b.exists())
    if a.exists() and b.exists(): check(rel+':byte-identical',sha(a)==sha(b))

css=read(ROOT/'shared/buyer-experience-ui.css')
for token in ['var(--ui3-navy-950)','var(--ui3-red)','var(--ui3-white)','var(--ui3-line)','var(--ui3-soft)','var(--ui3-soft-blue)']:
    check('buyer CSS token '+token,token in css)
for selector in ['body.buyer-page .buyer-hero','body.buyer-page .buyer-referral-pill','body.buyer-page .buyer-visual','body.buyer-page .buyer-intake-inner','body.buyer-page .buyer-form-card','body.buyer-page .buyer-progress','body.buyer-page .buyer-next','body.buyer-page .buyer-agent','body.buyer-page .buyer-thanks-card']:
    check('buyer CSS selector '+selector,selector in css)
check('Farmers red primary','background:var(--ui3-red)!important' in css and 'background:var(--ui3-red);' in css)
check('Farmers red focus','border-color:var(--ui3-red)!important' in css and 'box-shadow:var(--ui3-focus)!important' in css)
check('no giant headline',re.search(r'font-size\s*:\s*(?:7(?:\.\d+)?|8(?:\.\d+)?|9(?:\.\d+)?)rem',css) is None)
check('phone breakpoint','@media(max-width:620px)' in css)
check('tablet breakpoint','@media(max-width:980px)' in css)
check('short landscape support','max-height:520px' in css)
check('reduced motion support','prefers-reduced-motion' in css)
check('forced colors support','forced-colors:active' in css)

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

result={'sprint':'408-UI-3.5','suite':'source_contract','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'internal_links_checked':total,'broken_links':broken[:20],'checks':checks}
(ROOT/'UI3_5_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.5 QA: {result['passed']}/{result['total']} passed; internal links {total}, broken {len(broken)}")
sys.exit(1 if result['failed'] else 0)
