#!/usr/bin/env python3
from pathlib import Path
import hashlib, json, re, sys, zipfile
from urllib.parse import urlsplit
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]
BASE=Path('/mnt/data/ui31_baseline')
PUBLIC=[p for p in ROOT.rglob('*.html') if not p.relative_to(ROOT).as_posix().startswith(('qa/fixtures/','life-ops/'))]
checks=[]
def check(name,cond):
    checks.append({'name':name,'passed':bool(cond)})
    if not cond: print('FAIL',name)

def read(p): return p.read_text(errors='ignore')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def strip_ui31(s):
    s=re.sub(r'\s*<meta name="408farmers-ui-foundation" content="408-UI-3\.1"\s*/?>','',s)
    s=re.sub(r'\s*<link rel="stylesheet" href="/shared/ui-3-foundation\.css\?v=408-UI-3\.1"\s*/?>','',s)
    s=re.sub(r'\s*<script defer src="/shared/ui-3-foundation\.js\?v=408-UI-3\.1"></script>','',s)
    return s

check('foundation css exists',(ROOT/'shared/ui-3-foundation.css').exists())
check('foundation js exists',(ROOT/'shared/ui-3-foundation.js').exists())
check('nav logo exists',(ROOT/'shared/assets/408-farmers-nav-logo.png').exists())
check('sprint doc exists',(ROOT/'SPRINT-408-UI-3.1.md').exists())
check('roadmap exists',(ROOT/'408-UI-ROADMAP.md').exists())
check('contract exists',(ROOT/'UI3_1_FOUNDATION_CONTRACT.json').exists())

css=read(ROOT/'shared/ui-3-foundation.css')
js=read(ROOT/'shared/ui-3-foundation.js')
for token in ['--ui3-navy-950:#031a3d','--ui3-navy-800:#08285a','--ui3-red:#d71920','--ui3-white:#fff','--ui3-soft:#f6f8fb']:
    check('css token '+token,token in css)
for feature in ['.ui3-site-header','.ui3-primary-nav','.ui3-menu-toggle','.ui3-site-footer','.ui3-card','.ui3-alert--success']:
    check('css feature '+feature,feature in css)
for nav in ['Home','Home + Auto','Buyers','Local','Life','Contact']:
    check('nav item '+nav,nav in js)
check('mobile aria-expanded behavior',"aria-expanded" in js and 'Escape' in js)
check('universal footer runtime','ui3-footer-links' in js and 'CA License #4528400' in js)
check('body foundation marker',"body.dataset.uiFoundation='408-UI-3.1'" in js)

check('public HTML count',len(PUBLIC)==26)
for p in PUBLIC:
    rel=p.relative_to(ROOT)
    s=read(p)
    check(f'{rel}:css hook',s.count('ui-3-foundation.css?v=408-UI-3.1')==1)
    check(f'{rel}:js hook',s.count('ui-3-foundation.js?v=408-UI-3.1')==1)
    check(f'{rel}:meta hook',s.count('name="408farmers-ui-foundation"')==1)
    bp=BASE/rel
    check(f'{rel}:baseline exists',bp.exists())
    if bp.exists():
        norm=lambda x: re.sub(r'>\s+<','><',x.strip())
        check(f'{rel}:only UI3.1 hooks changed',norm(strip_ui31(s))==norm(read(bp)))

# Core behavior/runtime files must be byte-identical to LOCAL-1.10 baseline.
protected=['_worker.js','shared/config.js','shared/campaign.js','shared/coveragefit-launch.js','shared/local-attribution.js',
           'shared/local-data-model.js','shared/local-directory.js','shared/local-merchant.js','shared/local-join.js',
           'shared/life-secure-submit.js','shared/buyer-flow.js','shared/buyer-referral.js','shared/home-lead-progressive.js',
           'local/data/catalog.json','local/pilot/pilot-launch.json','local/pilot/stevies-qr-campaigns.json']
for rel in protected:
    a=ROOT/rel;b=BASE/rel
    check(rel+':present',a.exists() and b.exists())
    if a.exists() and b.exists(): check(rel+':byte-identical',sha(a)==sha(b))

# Static internal-link integrity across public HTML.
broken=[];total=0
for p in PUBLIC:
    soup=BeautifulSoup(read(p),'html.parser')
    for a in soup.find_all('a',href=True):
        href=a['href'].strip()
        if not href or href.startswith(('#','mailto:','tel:','sms:','javascript:','http://','https://')): continue
        parts=urlsplit(href)
        path=parts.path
        if not path: continue
        total+=1
        if path.startswith('/'):
            target=ROOT/path.lstrip('/')
        else:
            target=(p.parent/path).resolve()
        candidates=[target]
        if path.endswith('/') or target.is_dir(): candidates.append(target/'index.html')
        elif target.suffix=='': candidates.extend([Path(str(target)+'.html'),target/'index.html'])
        if not any(c.exists() for c in candidates): broken.append((str(p.relative_to(ROOT)),href))
check('internal links checked >= 120',total>=120)
check('internal links broken 0',len(broken)==0)

result={'sprint':'408-UI-3.1','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'internal_links_checked':total,'broken_links':broken[:20],'checks':checks}
(ROOT/'UI3_1_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.1 QA: {result['passed']}/{result['total']} passed; internal links {total}, broken {len(broken)}")
sys.exit(1 if result['failed'] else 0)
