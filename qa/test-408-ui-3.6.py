#!/usr/bin/env python3
from pathlib import Path
from collections import Counter
import hashlib,json,re,sys
from urllib.parse import urlsplit
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]
BASE=Path('/mnt/data/ui36_baseline')
checks=[]
def check(name,cond):
    checks.append({'name':name,'passed':bool(cond)})
    if not cond: print('FAIL',name)
def read(p): return p.read_text(errors='ignore')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def form_block(text):
    m=re.search(r'<form\b[\s\S]*?</form>',text,re.I)
    return m.group(0) if m else ''

routes={
 'healthcare':{'label':'Healthcare','hero':'Work in Healthcare?','sub':'Your healthcare role may qualify you for Farmers professional discounts. Dylan verifies availability during quoting and underwriting.','role':'Healthcare role','entry':'healthcare_eligibility_form','surface':'occupation_healthcare'},
 'teachers':{'label':'Teachers','hero':'Work in Education?','sub':'Teachers and school employees may qualify for Farmers professional discounts. Dylan verifies availability during quoting and underwriting.','role':'School or education role','entry':'teachers_eligibility_form','surface':'occupation_education'},
 'tech':{'label':'Technology','hero':'Work in Tech?','sub':'Your technology role may qualify you for Farmers professional discounts. Dylan verifies availability during quoting and underwriting.','role':'Tech role','entry':'tech_eligibility_form','surface':'occupation_tech'},
 'engineers':{'label':'Engineers','hero':'Are You an Engineer?','sub':'Your engineering field may qualify you for Farmers professional discounts. Dylan verifies availability during quoting and underwriting.','role':'Engineering field','entry':'engineers_eligibility_form','surface':'occupation_engineer'}
}

check('professional convergence css exists',(ROOT/'shared/professional-programs-ui.css').exists())
check('sprint doc exists',(ROOT/'SPRINT-408-UI-3.6.md').exists())
check('contract exists',(ROOT/'UI3_6_PROFESSIONAL_PROGRAMS_CONTRACT.json').exists())
check('roadmap exists',(ROOT/'408-UI-ROADMAP.md').exists())

switch_hrefs=['/healthcare/','/teachers/','/tech/','/engineers/']
for key,expected in routes.items():
    rel=f'{key}/index.html'
    new_text=read(ROOT/rel);base_text=read(BASE/rel)
    new=BeautifulSoup(new_text,'html.parser');base=BeautifulSoup(base_text,'html.parser')
    check(f'{key}: UI36 meta hook',new.find('meta',attrs={'name':'408farmers-ui-professional','content':'408-UI-3.6'}) is not None)
    check(f'{key}: UI36 css hook',len(new.find_all('link',href='/shared/professional-programs-ui.css?v=408-UI-3.6'))==1)
    check(f'{key}: UI31 foundation retained',len(new.find_all('link',href='/shared/ui-3-foundation.css?v=408-UI-3.1'))==1 and len(new.find_all('script',src='/shared/ui-3-foundation.js?v=408-UI-3.1'))==1)
    check(f'{key}: body UI hook',new.body and new.body.get('data-ui-professional')=='408-UI-3.6' and new.body.get('data-professional-program')==key)
    bar=new.find('nav',class_='professional-program-bar')
    check(f'{key}: family bar exists',bar is not None and '408FARMERS Professional Programs' in bar.get_text(' ',strip=True))
    links=bar.select('.professional-program-switcher a') if bar else []
    check(f'{key}: switcher has four programs',len(links)==4 and [a.get('href') for a in links]==switch_hrefs)
    current=[a.get_text(' ',strip=True) for a in links if a.get('aria-current')=='page']
    check(f'{key}: correct active program',current==[expected['label']])
    check(f'{key}: original h1 retained',new.find('h1') and new.find('h1').get_text(' ',strip=True)==expected['hero']==base.find('h1').get_text(' ',strip=True))
    check(f'{key}: conditional hero copy retained',new.find(class_='subhead') and new.find(class_='subhead').get_text(' ',strip=True)==expected['sub']==base.find(class_='subhead').get_text(' ',strip=True))
    check(f'{key}: eligibility verification language retained','Dylan verifies availability during quoting and underwriting.' in new_text and 'verify which Farmers professional discounts may be available' in new_text)
    check(f'{key}: truthful CoverageFit boundary retained','CoverageFit is educational, not a quote or eligibility decision.' in new_text)
    nf=new.find('form',id='leadForm');bf=base.find('form',id='leadForm')
    check(f'{key}: lead form exists',nf is not None and bf is not None)
    check(f'{key}: form markup byte-identical',form_block(new_text)==form_block(base_text))
    for attr in ['action','method','data-post-lead-engagement','data-coveragefit-invitation','data-cf-assessment','data-cf-entry','data-cf-extra-launch-surface','data-cf-next','data-cf-branch-field','data-cf-renter-destination','data-coveragefit-after-submit','data-success','data-sender-build','data-handoff-contract']:
        check(f'{key}: form attr {attr}',nf.get(attr)==bf.get(attr))
    check(f'{key}: entry retained',nf.get('data-cf-entry')==expected['entry'])
    check(f'{key}: launch surface retained',nf.get('data-cf-extra-launch-surface')==expected['surface'])
    new_names=Counter(x.get('name') for x in nf.find_all(['input','select','textarea']) if x.get('name'))
    base_names=Counter(x.get('name') for x in bf.find_all(['input','select','textarea']) if x.get('name'))
    check(f'{key}: field inventory unchanged',new_names==base_names)
    nsel=nf.find('select',attrs={'name':'occupation_segment'});bsel=bf.find('select',attrs={'name':'occupation_segment'})
    check(f'{key}: role label retained',nsel.find_parent('label').find('span').get_text(' ',strip=True)==expected['role'])
    check(f'{key}: occupation options unchanged',[o.get_text(' ',strip=True) for o in nsel.find_all('option')]==[o.get_text(' ',strip=True) for o in bsel.find_all('option')])
    check(f'{key}: consent unchanged',nf.find('label',class_='consent').get_text(' ',strip=True)==bf.find('label',class_='consent').get_text(' ',strip=True))
    check(f'{key}: direct contact unchanged',Counter(a.get('href') for a in new.select('.direct-contact-choice a[href]'))==Counter(a.get('href') for a in base.select('.direct-contact-choice a[href]')))
    check(f'{key}: runtime script inventory unchanged',Counter(s.get('src') for s in new.find_all('script',src=True))==Counter(s.get('src') for s in base.find_all('script',src=True)))
    check(f'{key}: no campaign image added to body',not re.search(rf'shared/assets/{key}(?:-|\.|\.webp)',str(new.body),re.I))
    ids=[x.get('id') for x in new.find_all(id=True)]
    check(f'{key}: no duplicate IDs',len(ids)==len(set(ids)))

# Non-professional public HTML remains byte-identical to UI-3.5 baseline.
public_base=[p for p in BASE.rglob('*.html') if not p.relative_to(BASE).as_posix().startswith(('qa/fixtures/','life-ops/'))]
check('public baseline html count >=26',len(public_base)>=26)
changed_allowed={f'{k}/index.html' for k in routes}
for b in public_base:
    rel=b.relative_to(BASE)
    if rel.as_posix() in changed_allowed: continue
    a=ROOT/rel
    check(f'{rel}:still exists',a.exists())
    if a.exists(): check(f'{rel}:byte-identical baseline',sha(a)==sha(b))

protected=[
'_worker.js','shared/ui-3-foundation.css','shared/ui-3-foundation.js','shared/home-conversion-ui.css','shared/auto-bundle-conversion-ui.css','shared/buyer-experience-ui.css',
'shared/occupational-simplification.css','shared/address-autocomplete.js','shared/coveragefit-launch.js','shared/prospect-profile.js','shared/post-lead-engagement.js','shared/coveragefit-invitation.js','shared/script.js','shared/config.js','shared/local-attribution.js','shared/life-secure-submit.js',
'local/data/catalog.json','local/pilot/pilot-launch.json','local/pilot/stevies-qr-campaigns.json'
]
for rel in protected:
    a=ROOT/rel;b=BASE/rel
    check(rel+':present',a.exists() and b.exists())
    if a.exists() and b.exists(): check(rel+':byte-identical',sha(a)==sha(b))

css=read(ROOT/'shared/professional-programs-ui.css')
for token in ['var(--ui3-navy-950)','var(--ui3-red)','var(--ui3-white)','var(--ui3-line)','var(--ui3-soft-blue)','var(--ui3-focus)']:
    check('professional CSS token '+token,token in css)
for selector in ['.professional-program-bar','.professional-program-switcher','body.occupational-page .occupational-hero','body.occupational-page .occupational-hero .quote-card','body.occupational-page #leadForm','.quote-card .meet-dylan','body.occupational-page .content-section','body.occupational-page .steps','body.occupational-page .agent-section']:
    check('professional CSS selector '+selector,selector in css)
check('shared eligibility boundary visible','not an automatic eligibility decision' in css)
check('Farmers red primary','background:var(--ui3-red)!important' in css)
check('Farmers red focus','border-color:var(--ui3-red)!important' in css and 'box-shadow:var(--ui3-focus)!important' in css)
check('no giant headline',re.search(r'font-size\s*:\s*(?:7(?:\.\d+)?|8(?:\.\d+)?|9(?:\.\d+)?)rem',css) is None)
check('phone breakpoint','@media(max-width:700px)' in css)
check('tablet breakpoint','@media(max-width:980px)' in css)
check('short landscape support','max-height:520px' in css)
check('reduced motion support','prefers-reduced-motion' in css)
check('forced colors support','forced-colors:active' in css)
check('mobile 16px field rule','font-size:16px!important' in css)
check('44px switcher targets','min-height:44px' in css)

# Internal links across public HTML.
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
check('internal links checked >=140',total>=140)
check('internal links broken 0',len(broken)==0)

result={'sprint':'408-UI-3.6','suite':'source_contract','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'internal_links_checked':total,'broken_links':broken[:20],'checks':checks}
(ROOT/'UI3_6_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.6 QA: {result['passed']}/{result['total']} passed; internal links {total}, broken {len(broken)}")
sys.exit(1 if result['failed'] else 0)
