#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'UI4_8_INPUT_BASELINE.json').read_text())
checks=[]
def check(name,cond,detail=None):
    checks.append({'name':name,'passed':bool(cond),'detail':detail})
    if not cond: print('FAIL',name,detail or '')
def sha(p): return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def read(p): return (ROOT/p).read_text(errors='ignore')

cssp=ROOT/'shared/editorial-responsive.css'
check('responsive css exists',cssp.exists())
css=cssp.read_text(errors='ignore')
for token in ['408-UI-4.8 — Mobile + Responsive Editorial Pass','env(safe-area-inset-top','env(safe-area-inset-bottom','font-size:16px!important','min-height:44px','@media(max-width:680px)','@media(max-width:420px)','@media(max-width:359px)','max-height:560px','orientation:landscape','professional-program-switcher','overflow-x:auto','ui47-score-editorial']:
    check('css token '+token,token in css)

pages=['404.html','auto-bundle/index.html','auto-bundle/thank-you.html','buyer/index.html','buyer/thank-you.html','contact/index.html','engineers/index.html','engineers/thank-you.html','healthcare/index.html','healthcare/thank-you.html','home/index.html','home/thank-you.html','index.html','local/detail/index.html','local/index.html','local/join/index.html','local/join/thank-you.html','neighbor/index.html','privacy.html','score/index.html','teachers/index.html','teachers/thank-you.html','tech/index.html','tech/thank-you.html','terms.html']
for rel in pages:
    soup=BeautifulSoup(read(rel),'html.parser')
    check(rel+' stylesheet',soup.find('link',href='/shared/editorial-responsive.css?v=408-UI-4.8') is not None)
    check(rel+' meta',soup.find('meta',attrs={'name':'408farmers-ui-responsive','content':'408-UI-4.8'}) is not None)
    check(rel+' body class','ui48-responsive' in (soup.body.get('class') or []))
    check(rel+' body data',soup.body.get('data-ui4-responsive')=='408-UI-4.8')
    vp=soup.find('meta',attrs={'name':'viewport'})
    check(rel+' viewport fit',vp is not None and 'viewport-fit=cover' in (vp.get('content') or ''))

for rel in ['life/index.html','life/thank-you.html','life-ops/index.html']:
    t=read(rel)
    check(rel+' excluded','editorial-responsive.css' not in t and 'ui48-responsive' not in t)

for rel,want in BASE['forms'].items():
    soup=BeautifulSoup(read(rel),'html.parser'); form=soup.find('form')
    got=hashlib.sha256(str(form).encode()).hexdigest() if form else None
    check(rel+' form exact',got==want)
for rel,want in BASE['protected_files'].items(): check(rel+' exact',sha(rel)==want)
for rel,want in BASE['life_files'].items(): check(rel+' life exact',sha(rel)==want)

road=read('408-UI-4-ROADMAP.md')
check('roadmap 4.8 complete','408-UI-4.8 — Mobile + Responsive Editorial Pass — COMPLETE' in road)
check('roadmap next 4.9','408-UI-4.9 — Accessibility + Performance Certification' in road)

out={'sprint':'408-UI-4.8','suite':'responsive_source_contract','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks}
(ROOT/'UI4_8_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-4.8 QA: {out['passed']}/{out['total']} passed")
sys.exit(1 if out['failed'] else 0)
