#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'UI3_13_1A_INPUT_BASELINE.json').read_text())
REG=json.loads((ROOT/'HUMAN-TRUST-COMPONENT-REGISTRY.json').read_text())
checks=[]
def check(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def body_hash(p):
    s=p.read_text(encoding='utf-8'); m=re.search(r'<body\b[^>]*>(.*)</body>',s,re.I|re.S)
    return hashlib.sha256((m.group(1) if m else '').encode()).hexdigest()

css=ROOT/'shared/human-trust.css'
check('foundation css exists',css.exists())
ct=css.read_text()
for cls in ['.ht-signature','.ht-editorial-intro','.ht-human-note','.ht-photo-frame','.ht-professional-accent','.ht-local-cue','.ht-personal-receipt','.ht-unboxed']:
    check(f'component {cls}',cls in ct)
check('forced colors support','forced-colors:active' in ct)
check('reduced motion support','prefers-reduced-motion:reduce' in ct)
check('registry life excluded',REG.get('life_excluded') is True)
check('next sprint locked',REG.get('next_sprint','').startswith('408-UI-3.13.1B'))

for item in BASE['public_html_body_hashes']:
    p=ROOT/item['path']; s=p.read_text()
    check(item['path']+' foundation marker','408farmers-human-trust-foundation' in s)
    check(item['path']+' foundation css','/shared/human-trust.css?v=408-UI-3.13.1A' in s)
    check(item['path']+' body byte-equivalent',body_hash(p)==item['sha256'])

for item in BASE['life_exact_hashes']:
    check(item['path']+' life exact',sha(ROOT/item['path'])==item['sha256'])
for item in BASE['infra_exact_hashes']:
    check(item['path']+' infra exact',sha(ROOT/item['path'])==item['sha256'])

# Life pages must not load the Human Trust layer.
for rel in ['life/index.html','life/thank-you.html','life-ops/index.html']:
    check(rel+' no foundation load','human-trust.css' not in (ROOT/rel).read_text())

# CSS is deliberately opt-in: no broad body selectors allowed.
check('foundation opt-in no body selector',not re.search(r'(^|[},]\\s*)body(?:[\\s.{:#\\[])',ct,re.M))
check('foundation opt-in no ui3-page selector','ui3-page' not in ct)

passed=sum(x['passed'] for x in checks)
out={'sprint':'408-UI-3.13.1A','suite':'human_trust_foundation','total':len(checks),'passed':passed,'failed':len(checks)-passed,'checks':checks}
(ROOT/'UI3_13_1A_QA.json').write_text(json.dumps(out,indent=2)+'\\n')
print(f'{passed}/{len(checks)}')
sys.exit(0 if passed==len(checks) else 1)
