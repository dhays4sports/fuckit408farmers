#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
base=json.loads((ROOT/'UI4_1_INPUT_BASELINE.json').read_text())
checks=[]
def h(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def check(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)

css=ROOT/'shared/editorial-platform.css'; js=ROOT/'shared/editorial-platform.js'
for p in [css,js,ROOT/'EDITORIAL-PLATFORM-DESIGN-SYSTEM.md',ROOT/'EDITORIAL-PLATFORM-COMPONENT-REGISTRY.json',ROOT/'408-UI-4-ROADMAP.md',ROOT/'SPRINT-408-UI-4.1.md']:
    check('exists '+p.name,p.exists())

ct=css.read_text(); jt=js.read_text()
for token in ['--ui4-gold-700','--ui4-gold-500','ui4-editorial-hero','ui4-action-panel','ui4-relationship-band','ui4-editorial-columns','ui4-trust-strip']:
    check('css '+token,token in ct)
for token in ['Professionals','Text or Call Dylan','sms:+14083276377','tel:+14083276377','ui4-page']:
    check('js '+token,token in jt)
check('red remains action documented','Farmers red' in (ROOT/'EDITORIAL-PLATFORM-DESIGN-SYSTEM.md').read_text())
check('life excluded documented','Life is explicitly excluded' in (ROOT/'EDITORIAL-PLATFORM-DESIGN-SYSTEM.md').read_text())

for rel,old in base['nonlife_body_hashes'].items():
    p=ROOT/rel; txt=p.read_text(errors='replace')
    m=re.search(r'(<body\b.*?</body>)',txt,flags=re.I|re.S)
    now=hashlib.sha256((m.group(1) if m else '').encode()).hexdigest()
    check('body exact '+rel,now==old)
    check('marker '+rel,'408farmers-editorial-platform' in txt)
    check('css ref '+rel,'/shared/editorial-platform.css?v=408-UI-4.1' in txt)
    check('js ref '+rel,'/shared/editorial-platform.js?v=408-UI-4.1' in txt)

for rel,old in base['life_file_hashes'].items():
    p=ROOT/rel
    check('life exact '+rel,h(p)==old)
    txt=p.read_text(errors='replace')
    check('life no ui4 '+rel,'editorial-platform' not in txt and '408-UI-4.1' not in txt)

for rel,old in base['protected_hashes'].items():
    check('protected exact '+rel,h(ROOT/rel)==old)

road=(ROOT/'408-UI-4-ROADMAP.md').read_text()
for sprint in range(1,11):
    check(f'roadmap 4.{sprint}',f'408-UI-4.{sprint}' in road)
for phrase in ['Homepage Editorial Convergence','Home + Bundle Editorial Convergence','Buyer Editorial Convergence','Professional Programs Campaign Convergence','Local Community Convergence','Relationship + Completion Editorial Convergence','Mobile + Responsive Editorial Pass','Accessibility + Performance Certification','Functional Regression + Production Certification']:
    check('roadmap detail '+phrase,phrase in road)

passed=sum(x['passed'] for x in checks)
out={'sprint':'408-UI-4.1','suite':'editorial_platform_foundation','total':len(checks),'passed':passed,'failed':len(checks)-passed,'checks':checks}
(ROOT/'UI4_1_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-4.1 QA: {passed}/{len(checks)} passed')
sys.exit(0 if passed==len(checks) else 1)
