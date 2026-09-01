#!/usr/bin/env python3
from pathlib import Path
from collections import Counter
import hashlib,json,re,sys
from urllib.parse import urlsplit
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]
BASE=Path('/mnt/data/ui32_baseline')
checks=[]
def check(name,cond):
    checks.append({'name':name,'passed':bool(cond)})
    if not cond: print('FAIL',name)
def read(p): return p.read_text(errors='ignore')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def norm_node(node):
    return re.sub(r'>\s+<','><',str(node).strip())

check('homepage css exists',(ROOT/'shared/homepage-platform.css').exists())
check('sprint doc exists',(ROOT/'SPRINT-408-UI-3.2.md').exists())
check('contract exists',(ROOT/'UI3_2_HOMEPAGE_CONTRACT.json').exists())
check('roadmap exists',(ROOT/'408-UI-ROADMAP.md').exists())

new=BeautifulSoup(read(ROOT/'index.html'),'html.parser')
base=BeautifulSoup(read(BASE/'index.html'),'html.parser')
check('UI32 meta hook',new.find('meta',attrs={'name':'408farmers-homepage-redesign','content':'408-UI-3.2'}) is not None)
check('UI32 css hook',len(new.find_all('link',href='/shared/homepage-platform.css?v=408-UI-3.2'))==1)
check('UI31 foundation retained',len(new.find_all('link',href='/shared/ui-3-foundation.css?v=408-UI-3.1'))==1 and len(new.find_all('script',src='/shared/ui-3-foundation.js?v=408-UI-3.1'))==1)
check('one h1',len(new.find_all('h1'))==1)
check('platform h1',new.find('h1') and new.find('h1').get_text(' ',strip=True)=='Insurance for South Bay households.')
check('main landmark',new.find('main',id='main-content') is not None)
check('skip link',new.find('a',class_='skip-link',href='#main-content') is not None)
for sid in ['start','professionals','local','contact']:
    check('section id '+sid,new.find(id=sid) is not None)

# Primary product hub.
products=new.select('.ui32-product-grid .ui32-product-card')
check('four primary product cards',len(products)==4)
hrefs=[a.get('href') for a in products]
for href in ['home/','auto-bundle/','buyer/','life/']:
    check('primary route '+href,href in hrefs)
more=[a.get('href') for a in new.select('.ui32-more-grid a')]
for href in ['score/','contact/?intent=business','contact/?intent=landlord']:
    check('more route '+href,href in more)
for href in ['healthcare/','teachers/','tech/','engineers/']:
    check('professional route '+href,new.find('a',href=href) is not None)
check('Local insurance separation copy','No insurance purchase or quote is required to use a public Local perk.' in new.get_text(' ',strip=True))
check('Dylan license visible','CA License #4528400' in new.get_text(' ',strip=True))

# Every pre-existing href and tracked destination remains present. New links are allowed.
base_hrefs=Counter(a.get('href') for a in base.find_all('a',href=True))
new_hrefs=Counter(a.get('href') for a in new.find_all('a',href=True))
missing_hrefs=base_hrefs-new_hrefs
check('all baseline href destinations preserved',sum(missing_hrefs.values())==0)
def tracks(soup):
    return Counter((a.get('data-track-event'),a.get('data-track-location'),a.get('data-track-label'),a.get('href')) for a in soup.find_all('a',href=True) if a.get('data-track-event'))
missing_tracks=tracks(base)-tracks(new)
check('all baseline tracked anchor contracts preserved',sum(missing_tracks.values())==0)

# Source header/footer remain semantically unchanged; UI-3.1 enhances them at runtime.
check('source header preserved',norm_node(new.find('header'))==norm_node(base.find('header')))
check('source footer preserved',norm_node(new.find('footer'))==norm_node(base.find('footer')))
# Runtime script inventory remains unchanged.
base_scripts=Counter((x.get('src'),x.get_text(strip=True)) for x in base.find_all('script'))
new_scripts=Counter((x.get('src'),x.get_text(strip=True)) for x in new.find_all('script'))
check('homepage runtime scripts preserved',base_scripts==new_scripts)

# Every other public HTML surface is byte-identical to UI-3.1.
public_base=[p for p in BASE.rglob('*.html') if not p.relative_to(BASE).as_posix().startswith(('qa/fixtures/','life-ops/'))]
check('public baseline html count >=26',len(public_base)>=26)
for b in public_base:
    rel=b.relative_to(BASE)
    if rel.as_posix()=='index.html': continue
    a=ROOT/rel
    check(f'{rel}:still exists',a.exists())
    if a.exists(): check(f'{rel}:byte-identical UI31',sha(a)==sha(b))

# Protected code/assets must be byte-identical to UI-3.1.
protected=[
'_worker.js','shared/ui-3-foundation.css','shared/ui-3-foundation.js','shared/homepage-optimization.js',
'shared/config.js','shared/campaign.js','shared/coveragefit-launch.js','shared/local-attribution.js',
'shared/local-data-model.js','shared/local-directory.js','shared/local-merchant.js','shared/local-join.js',
'shared/life-secure-submit.js','shared/buyer-flow.js','shared/buyer-referral.js','shared/home-lead-progressive.js',
'local/data/catalog.json','local/pilot/pilot-launch.json','local/pilot/stevies-qr-campaigns.json'
]
for rel in protected:
    a=ROOT/rel;b=BASE/rel
    check(rel+':present',a.exists() and b.exists())
    if a.exists() and b.exists(): check(rel+':byte-identical',sha(a)==sha(b))

# Homepage CSS must consume UI3 tokens and avoid legacy green/gold primary branding.
css=read(ROOT/'shared/homepage-platform.css')
for token in ['var(--ui3-navy-950)','var(--ui3-red)','var(--ui3-white)','var(--ui3-line)','var(--ui3-soft)']:
    check('homepage css token '+token,token in css)
check('no 9rem homepage headline','9rem' not in css)
check('responsive 620 breakpoint','@media(max-width:620px)' in css)
check('reduced motion support','prefers-reduced-motion' in css)

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

result={'sprint':'408-UI-3.2','suite':'source_contract','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'missing_hrefs':list(missing_hrefs.items()),'missing_tracks':[list(x)+[n] for x,n in missing_tracks.items()],'internal_links_checked':total,'broken_links':broken[:20],'checks':checks}
(ROOT/'UI3_2_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.2 QA: {result['passed']}/{result['total']} passed; internal links {total}, broken {len(broken)}")
sys.exit(1 if result['failed'] else 0)
