#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from collections import Counter
from urllib.parse import urlsplit
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'UI3_13_1C_INPUT_BASELINE.json').read_text())
checks=[]
def check(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def control_contract(form):
    out=[]
    for e in form.select('input,select,textarea,button'):
        out.append({'tag':e.name,'name':e.get('name'),'type':e.get('type'),'required':e.has_attr('required'),'value':e.get('value'),'options':[{'value':o.get('value'),'text':o.get_text(' ',strip=True)} for o in e.select('option')] if e.name=='select' else None,'data':{k:v for k,v in e.attrs.items() if k.startswith('data-')}})
    return out

css=ROOT/'shared/core-insurance-human.css'
check('core stylesheet exists',css.exists())
ct=css.read_text() if css.exists() else ''
for token in ['homepage-human-signature','home-human-signature','bundle-human-signature','buyer-human-signature','forced-colors:active','prefers-reduced-motion:reduce']:
    check('css '+token,token in ct)
check('core CSS no professional gold', '--ht-gold' not in ct and '--pro-gold' not in ct)

expected={
 'index.html':('homepage-human-signature','Your local producer: Dylan Haysbert'),
 'home/index.html':('home-human-signature','Your review is handled by Dylan Haysbert'),
 'auto-bundle/index.html':('bundle-human-signature','One household review with Dylan'),
 'buyer/index.html':('buyer-human-signature','Dylan stays with the insurance side of the closing'),
}
for rel,(sig_cls,sig_copy) in expected.items():
    soup=BeautifulSoup((ROOT/rel).read_text(),'html.parser')
    check(rel+' core marker',soup.body.get('data-human-trust-core')=='408-UI-3.13.1C')
    check(rel+' core css',soup.find('link',href='/shared/core-insurance-human.css?v=408-UI-3.13.1C') is not None)
    check(rel+' one h1',len(soup.find_all('h1'))==BASE['target_contracts'][rel]['h1_count']==1)
    sig=soup.select_one('.'+sig_cls)
    check(rel+' signature exists',sig is not None)
    check(rel+' signature copy',sig is not None and sig_copy in sig.get_text(' ',strip=True))
    img=sig.select_one('img.ht-signature__portrait') if sig else None
    check(rel+' Dylan portrait',img is not None and 'dylan-headshot-160.webp' in img.get('src',''))
    check(rel+' Dylan portrait alt',img is not None and img.get('alt')=='Dylan Haysbert')
    # Existing links and scripts are preserved; new trust links may be additive.
    old=Counter(BASE['target_contracts'][rel]['hrefs'])
    new=Counter(a.get('href') for a in soup.find_all('a',href=True))
    check(rel+' old hrefs preserved',all(new[k]>=v for k,v in old.items()),str(old-new))
    old_scripts=Counter(BASE['target_contracts'][rel]['scripts'])
    new_scripts=Counter(x.get('src') for x in soup.find_all('script',src=True))
    check(rel+' runtime scripts preserved',all(new_scripts[k]>=v for k,v in old_scripts.items()),str(old_scripts-new_scripts))
    check(rel+' existing ids preserved',set(BASE['target_contracts'][rel]['ids']).issubset({x.get('id') for x in soup.find_all(id=True)}))

# Specific humanization requirements.
homepage=BeautifulSoup((ROOT/'index.html').read_text(),'html.parser')
check('homepage first-person support','Tell me what changed' in homepage.select_one('.ui32-hero-support').get_text(' ',strip=True))
check('homepage abstract trust chips removed',homepage.select_one('.ui32-trust-row') is None)
check('homepage coveragefit warmer','before you talk with Dylan' in homepage.select_one('.ui32-method-copy p').get_text(' ',strip=True))

home=BeautifulSoup((ROOT/'home/index.html').read_text(),'html.parser')
check('home review title humanized',home.select_one('.home-review-intro h2').get_text(' ',strip=True)=="Let’s see what’s worth reviewing.")
check('home campaign title hook preserved',home.select_one('[data-home-campaign-title]') is not None)
check('home campaign CTA hook preserved',home.select_one('[data-home-campaign-cta]') is not None)

bundle=BeautifulSoup((ROOT/'auto-bundle/index.html').read_text(),'html.parser')
check('bundle consultative section',bundle.select_one('.content-section h2').get_text(' ',strip=True)=="Let’s look at the household together.")
check('bundle no duplicate meet Dylan',bundle.select_one('.quote-card .meet-dylan') is None)
check('bundle renter copy preserved concept','If you rent' in bundle.select_one('.review-intro').get_text(' ',strip=True))
check('bundle campaign hooks preserved',all(bundle.select_one(x) is not None for x in ['[data-campaign-entry-title]','[data-campaign-entry-lead]','[data-campaign-entry-form-title]','[data-campaign-entry-submit]']))

buyer=BeautifulSoup((ROOT/'buyer/index.html').read_text(),'html.parser')
check('buyer concierge title',buyer.select_one('#buyer-review-title').get_text(' ',strip=True)=="Let’s keep the insurance side moving.")
check('buyer campaign hooks preserved',all(buyer.select_one(x) is not None for x in ['[data-campaign-entry-title]','[data-campaign-entry-lead]','[data-campaign-entry-body]','[data-campaign-entry-start-online]']))
check('buyer referral hook preserved',buyer.select_one('[data-buyer-referral]') is not None)

# Core forms stay exactly equivalent to 3.13.1B.
for slug,rel in [('home','home/index.html'),('auto_bundle','auto-bundle/index.html'),('buyer','buyer/index.html')]:
    soup=BeautifulSoup((ROOT/rel).read_text(),'html.parser'); f=soup.select_one('#leadForm'); b=BASE['forms'][slug]
    check(slug+' form exists',f is not None)
    check(slug+' form action',f.get('action')==b['action'])
    check(slug+' form method',f.get('method')==b['method'])
    check(slug+' form attributes',dict(f.attrs)==b['attrs'])
    check(slug+' form controls exact',control_contract(f)==b['controls'])
    check(slug+' form HTML exact',hashlib.sha256(str(f).encode()).hexdigest()==b['html_sha'])

# Protected behavior and excluded surfaces remain exact to input baseline.
for rel,h in BASE['protected_files'].items():
    p=ROOT/rel
    check(rel+' protected exists',p.exists())
    if p.exists(): check(rel+' protected hash',sha(p)==h)

# Required docs.
for rel in ['CORE_INSURANCE_HUMANIZATION_CONTRACT.json','SPRINT-408-UI-3.13.1C.md','HUMAN-TRUST-DESIGN-SYSTEM.md','HUMAN-TRUST-COMPONENT-REGISTRY.json','408-UI-ROADMAP.md']:
    check(rel+' exists',(ROOT/rel).exists())

# Public internal link integrity.
public=[p for p in ROOT.rglob('*.html') if not p.relative_to(ROOT).as_posix().startswith(('qa/fixtures/','life-ops/','_core_previews/'))]
broken=[];total=0
for p in public:
    soup=BeautifulSoup(p.read_text(errors='ignore'),'html.parser')
    for a in soup.find_all('a',href=True):
        href=a['href'].strip()
        if not href or href.startswith(('#','mailto:','tel:','sms:','javascript:','http://','https://')): continue
        path=urlsplit(href).path
        if not path: continue
        total+=1
        target=ROOT/path.lstrip('/') if path.startswith('/') else (p.parent/path).resolve()
        cand=[target]
        if path.endswith('/') or target.is_dir(): cand.append(target/'index.html')
        elif target.suffix=='': cand += [Path(str(target)+'.html'),target/'index.html']
        if not any(x.exists() for x in cand): broken.append((str(p.relative_to(ROOT)),href))
check('internal links >=150',total>=150,str(total))
check('internal links broken 0',len(broken)==0,str(broken[:10]))

passed=sum(x['passed'] for x in checks)
out={'sprint':'408-UI-3.13.1C','suite':'core_insurance_humanization_source','total':len(checks),'passed':passed,'failed':len(checks)-passed,'internal_links_checked':total,'broken_links':broken,'checks':checks}
(ROOT/'UI3_13_1C_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-3.13.1C source QA: {passed}/{len(checks)} passed; links {total}, broken {len(broken)}')
sys.exit(0 if passed==len(checks) else 1)
