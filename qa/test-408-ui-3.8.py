#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import hashlib,json,re,sys
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]
BASE=Path('/mnt/data/ui38_baseline')
checks=[]
def check(name,cond):
    checks.append({'name':name,'passed':bool(cond)})
    if not cond: print('FAIL',name)
def read(p): return p.read_text(errors='ignore')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def form_block(text):
    m=re.search(r'<form\b[\s\S]*?</form>',text,re.I)
    return m.group(0) if m else ''

check('visual convergence css exists',(ROOT/'shared/local-visual-convergence.css').exists())
check('sprint doc exists',(ROOT/'SPRINT-408-UI-3.8.md').exists())
check('contract exists',(ROOT/'UI3_8_LOCAL_VISUAL_CONVERGENCE_CONTRACT.json').exists())
check('roadmap exists',(ROOT/'408-UI-ROADMAP.md').exists())

for rel in ['local/index.html','local/detail/index.html','local/join/index.html']:
    soup=BeautifulSoup(read(ROOT/rel),'html.parser')
    check(rel+' UI38 meta',soup.find('meta',attrs={'name':'408farmers-ui-local','content':'408-UI-3.8'}) is not None)
    check(rel+' UI38 css',len(soup.find_all('link',href='/shared/local-visual-convergence.css?v=408-UI-3.8'))==1)
    check(rel+' UI31 retained',len(soup.find_all('link',href='/shared/ui-3-foundation.css?v=408-UI-3.1'))==1 and len(soup.find_all('script',src='/shared/ui-3-foundation.js?v=408-UI-3.1'))==1)
    check(rel+' body hook',soup.body is not None and soup.body.get('data-ui-local')=='408-UI-3.8')

# Directory-first composition and core separation language.
idx=BeautifulSoup(read(ROOT/'local/index.html'),'html.parser')
main=idx.find('main',id='main-content')
children=[c for c in main.find_all('section',recursive=False)] if main else []
ids=[c.get('id') or ('hero' if 'local-hero' in (c.get('class') or []) else '') for c in children]
check('directory follows hero',len(ids)>=2 and ids[0]=='hero' and ids[1]=='directory')
check('compact Local identity',idx.find(id='local-title') is not None and idx.find(id='local-title').get_text(' ',strip=True)=='South Bay Local.')
check('directory filters retained',len(idx.select('[data-local-filter]'))==4)
check('no insurance purchase boundary retained','No insurance purchase' in main.get_text(' ',strip=True))
check('no quote boundary retained','No quote required' in main.get_text(' ',strip=True))

# Protected Local runtime/data are byte-identical to UI-3.7 input.
protected=[
 '_worker.js','shared/local-data-model.js','shared/local-directory.js','shared/local-merchant.js',
 'shared/local-attribution.js','shared/local-join.js','local/data/catalog.json',
 'local/pilot/pilot-launch.json','local/pilot/stevies-qr-campaigns.json'
]
for rel in protected:
    check(rel+' byte-identical',sha(ROOT/rel)==sha(BASE/rel))

# Merchant join submission contract preserved semantically.
def form_signature(text):
    soup=BeautifulSoup(text,'html.parser')
    form=soup.find('form',id='localMerchantJoinForm')
    controls=[]
    if form:
        for el in form.find_all(['input','select','textarea','button']):
            controls.append({
                'tag':el.name,'name':el.get('name'),'type':el.get('type'),'id':el.get('id'),
                'required':el.has_attr('required'),'value':el.get('value'),
                'proxy':form.get('data-proxy-endpoint'),'success':form.get('data-success'),
                'action':form.get('action'),'method':(form.get('method') or '').lower()
            })
    return controls
check('merchant join form contract unchanged',form_signature(read(ROOT/'local/join/index.html'))==form_signature(read(BASE/'local/join/index.html')))

# No unsupported mockup features invented.
public_local='\n'.join(read(ROOT/p) for p in ['local/index.html','local/detail/index.html','local/join/index.html'])
css=read(ROOT/'shared/local-visual-convergence.css')
for label,pat in [
 ('no distance UI',r'\b(?:mi away|miles away|distance from you)\b'),
 ('no ratings UI',r'\b(?:star rating|review count|customer rating)\b'),
 ('no browser geolocation',r'navigator\.geolocation'),
 ('no fake map surface',r'data-local-map')
]: check(label,re.search(pat,public_local+'\n'+css,re.I) is None)

catalog=json.loads(read(ROOT/'local/data/catalog.json'))
stevies=next(m for m in catalog['merchants'] if m['merchant_id']=='stevies-bar-grill-sj')
check('Stevies imagery not fabricated',stevies.get('image') is None and stevies.get('logo') is None)
check('Stevies remains active real pilot',stevies.get('status')=='active' and stevies.get('fixture') is False)
check('Auto fixture remains non-public',next(m for m in catalog['merchants'] if m['merchant_id']=='fixture-auto-001')['status']=='draft')
check('Home fixture remains non-public',next(m for m in catalog['merchants'] if m['merchant_id']=='fixture-home-001')['status']=='draft')

# Visual-system contract.
for selector in [
 '.local-directory-grid','.local-merchant-card','.local-detail-perk','.local-redemption-dialog',
 '.local-insurance-bridge','.local-join-form-card','.local-filter.is-active'
]: check('CSS selector '+selector,selector in css)
check('Farmers red active filters','background:var(--local-navy)' in css and 'var(--local-red)' in css)
check('restrained radius','border-radius:16px' in css)
check('phone breakpoint','@media(max-width:700px)' in css)
check('tablet breakpoint','@media(max-width:980px)' in css)
check('short landscape support','max-height:520px' in css)
check('reduced motion support','prefers-reduced-motion:reduce' in css)
check('forced colors support','forced-colors:active' in css)
check('mobile 16px controls','font-size:16px!important' in css)

# Non-Local product entry HTML remains byte-identical to UI-3.7 input.
for rel in ['index.html','home/index.html','auto-bundle/index.html','buyer/index.html','life/index.html','healthcare/index.html','teachers/index.html','tech/index.html','engineers/index.html']:
    check(rel+' non-Local unchanged',sha(ROOT/rel)==sha(BASE/rel))

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
check('internal links checked >=150',total>=150)
check('internal links broken 0',len(broken)==0)

result={'sprint':'408-UI-3.8','suite':'source_contract','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'internal_links_checked':total,'broken_links':broken[:20],'checks':checks}
(ROOT/'UI3_8_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.8 QA: {result['passed']}/{result['total']} passed; internal links {total}, broken {len(broken)}")
sys.exit(1 if result['failed'] else 0)
