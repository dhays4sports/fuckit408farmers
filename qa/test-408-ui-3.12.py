#!/usr/bin/env python3
from pathlib import Path
import json, sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,cond,detail=''):
    checks.append({'name':name,'passed':bool(cond),'detail':detail if not cond else ''})
    if not cond: print('FAIL',name,detail)

def qafile(name,expected=None):
    p=ROOT/name
    check(name+' exists',p.is_file())
    if not p.is_file(): return None
    try: d=json.loads(p.read_text())
    except Exception as e:
        check(name+' valid JSON',False,str(e)); return None
    check(name+' valid JSON',True)
    total=d.get('total',len(d.get('checks',[])))
    passed=d.get('passed',total-d.get('failed',0))
    failed=d.get('failed',total-passed)
    check(name+' zero failures',failed==0,str(failed))
    check(name+' fully passed',passed==total,f'{passed}/{total}')
    if expected is not None:
        check(name+' expected count',total==expected,f'{total} != {expected}')
    return d

check('VERSION advanced',(ROOT/'VERSION').read_text().strip()=='408-UI-3.12 + 408-UI-3.2.1')
road=(ROOT/'408-UI-ROADMAP.md').read_text()
check('roadmap marks 3.12 complete','408-UI-3.12 — End-to-End Functional Regression — COMPLETE' in road)
check('roadmap locks 3.13','1. **408-UI-3.13 — Production Design Certification**' in road)
check('roadmap no longer locks 3.12','1. **408-UI-3.12 — End-to-End Functional Regression**' not in road)
check('sprint doc exists',(ROOT/'SPRINT-408-UI-3.12.md').is_file())
check('release certification exists',(ROOT/'UI3_12_RELEASE_CERTIFICATION.json').is_file())
check('regression matrix exists',(ROOT/'UI3_12_REGRESSION_MATRIX.json').is_file())
check('E2E test exists',(ROOT/'qa/test-408-ui-3.12-e2e.py').is_file())
check('E2E test has no development route prints',"print('ROUTE'" not in (ROOT/'qa/test-408-ui-3.12-e2e.py').read_text())

# 3.12-owned QA
qafile('UI3_12_E2E_QA.json',59)
qafile('UI3_12_JS_SYNTAX_QA.json',41)
qafile('UI3_12_BEHAVIOR_FREEZE_QA.json',73)
qafile('UI3_12_PRODUCT_FREEZE_QA.json',160)

# Latest applicable current-surface regressions rerun for 3.12.
for f,n in [
 ('UI3_11_1_QA.json',82),('UI3_11_1_BROWSER_QA.json',51),('UI3_11_1_ACCESSIBILITY_QA.json',56),
 ('UI3_2_1_BROWSER_QA.json',93),('UI3_3_BROWSER_QA.json',108),('UI3_4_BROWSER_QA.json',99),('UI3_5_BROWSER_QA.json',115),
 ('UI3_6_BROWSER_QA.json',452),('UI3_7_BROWSER_QA.json',23),('UI3_8_BROWSER_QA.json',155),('UI3_9_BROWSER_QA.json',293),
 ('UI3_10_BROWSER_QA.json',822),('LOCAL1_10_BROWSER_QA.json',210),('B1_2D_QA.json',296),
 ('LOCAL1_5_WORKER_QA.json',20),('LOCAL1_6_WORKER_QA.json',29)]:
    qafile(f,n)

matrix=json.loads((ROOT/'UI3_12_REGRESSION_MATRIX.json').read_text())
check('matrix certified',matrix.get('status')=='pass')
check('matrix has all suites',len(matrix.get('suites',[]))>=25,str(len(matrix.get('suites',[]))))
check('matrix all certified',all(x.get('certified') for x in matrix.get('suites',[])))
check('matrix documents deterministic network boundary','deterministic' in matrix.get('note','').lower())

cert=json.loads((ROOT/'UI3_12_RELEASE_CERTIFICATION.json').read_text())
check('cert sprint',cert.get('sprint')=='408-UI-3.12')
check('cert status',cert.get('status')=='certified')
check('cert behavior frozen',cert.get('behavior_frozen') is True)
check('cert no customer-facing changes',cert.get('customer_facing_changes') is False)
check('cert E2E',cert.get('e2e',{}).get('passed')==59 and cert.get('e2e',{}).get('total')==59)
check('cert next sprint',cert.get('next_sprint')=='408-UI-3.13 — Production Design Certification')
check('cert Local NO-GO preserved','NO-GO' in cert.get('local_status',''))
check('cert live smoke boundary','3.13' in cert.get('live_smoke_boundary',''))

sprint=(ROOT/'SPRINT-408-UI-3.12.md').read_text()
for token in ['59/59','73/73','160/160','Home + Auto','Professional Programs','SSN last four','LOCAL-1.10','NO-GO','408-UI-3.13']:
    check('sprint doc '+token,token in sprint)

# Product runtime is explicitly not stamped with 3.12; this is a regression-only sprint.
for rel in ['index.html','home/index.html','auto-bundle/index.html','buyer/index.html','life/index.html','local/index.html','_worker.js']:
    txt=(ROOT/rel).read_text(errors='ignore')
    check(rel+' no 3.12 product mutation marker','408-UI-3.12' not in txt)

failed=[x for x in checks if not x['passed']]
result={'sprint':'408-UI-3.12','suite':'release_source_contract','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(ROOT/'UI3_12_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.12 Source QA: {result['passed']}/{result['total']} passed")
sys.exit(1 if failed else 0)
