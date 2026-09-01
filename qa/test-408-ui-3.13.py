#!/usr/bin/env python3
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,cond,detail=''):
    checks.append({'name':name,'passed':bool(cond),'detail':'' if cond else str(detail)})
    if not cond: print('FAIL',name,detail)
def qafile(name,expected=None):
    p=ROOT/name;check(name+' exists',p.is_file())
    if not p.is_file(): return None
    try:d=json.loads(p.read_text())
    except Exception as e:check(name+' valid JSON',False,e);return None
    check(name+' valid JSON',True)
    total=d.get('total');passed=d.get('passed');failed=d.get('failed',0)
    if total is not None:
        check(name+' zero failures',failed==0,failed);check(name+' fully passed',passed==total,f'{passed}/{total}')
        if expected is not None: check(name+' expected count',total==expected,f'{total}!={expected}')
    return d
check('VERSION final',(ROOT/'VERSION').read_text().strip()=='408-UI-3.13 + 408-INFRA-1.1 + 408-UI-3.2.1')
road=(ROOT/'408-UI-ROADMAP.md').read_text()
check('roadmap marks 3.13 complete','408-UI-3.13 — Production Design Certification — COMPLETE' in road)
check('roadmap marks UI3 complete','UI-3.x status' in road and 'COMPLETE' in road)
check('roadmap has no locked 3.13 sequence','## Locked sequence' not in road)
for f in ['SPRINT-408-UI-3.13.md','PRODUCTION-DESIGN-CERTIFICATION.md','UI3_13_DEPLOYMENT_SMOKE_RUNBOOK.md','UI3_13_RELEASE_CERTIFICATION.json','UI3_13_REGRESSION_MATRIX.json','robots.txt','sitemap.xml']:
    check(f+' exists',(ROOT/f).is_file())
for f,n in [('UI3_13_BROWSER_QA.json',749),('UI3_13_METADATA_QA.json',216),('UI3_13_ASSET_PERFORMANCE_QA.json',99),('UI3_13_FREEZE_QA.json',66),('UI3_13_JS_SYNTAX_QA.json',41),('UI3_13_LINK_QA.json',640),('UI3_13_INFRA_PRESERVATION_QA.json',4),('UI3_12_E2E_QA.json',59),('UI3_11_1_BROWSER_QA.json',51),('UI3_11_1_ACCESSIBILITY_QA.json',56),('UI3_2_1_BROWSER_QA.json',93),('UI3_3_BROWSER_QA.json',108),('UI3_4_BROWSER_QA.json',99),('UI3_5_BROWSER_QA.json',115),('UI3_6_BROWSER_QA.json',452),('UI3_7_BROWSER_QA.json',23),('UI3_8_BROWSER_QA.json',155),('UI3_9_BROWSER_QA.json',293),('UI3_10_BROWSER_QA.json',822),('B1_2D_QA.json',296),('LOCAL1_5_WORKER_QA.json',20),('LOCAL1_6_WORKER_QA.json',29)]:qafile(f,n)
m=json.loads((ROOT/'UI3_13_REGRESSION_MATRIX.json').read_text())
check('matrix pass',m.get('status')=='pass')
check('matrix 27 suites',len(m.get('suites',[]))==27,len(m.get('suites',[])))
check('matrix all certified',all(x.get('certified') for x in m.get('suites',[])))
c=json.loads((ROOT/'UI3_13_RELEASE_CERTIFICATION.json').read_text())
check('cert sprint',c.get('sprint')=='408-UI-3.13')
check('cert status',c.get('status')=='certified')
check('cert deployable build',c.get('certification_level')=='deployable_build')
check('cert program complete',c.get('ui3_program_status')=='complete')
check('cert behavior frozen',c.get('behavior_frozen') is True)
check('cert no functional changes',c.get('functional_changes') is False)
check('cert runtime freeze',c.get('runtime_freeze',{}).get('files')=='47/47')
check('cert form freeze',c.get('runtime_freeze',{}).get('form_contracts')=='9/9')
check('cert post deploy smoke boundary',c.get('deployment_activation')=='pending_post_deploy_smoke')
check('cert Local NO-GO preserved','NO-GO' in c.get('local_status',''))
check('cert no next sprint',c.get('next_sprint') is None)

# Preserve the unrelated 408-INFRA-1.1 hotfix inside the final UI baseline.
check('_routes.json preserved',(ROOT/'_routes.json').is_file())
infra=json.loads((ROOT/'INFRA1_1_RELEASE_CERTIFICATION.json').read_text()) if (ROOT/'INFRA1_1_RELEASE_CERTIFICATION.json').is_file() else {}
check('infra certification preserved',infra.get('sprint')=='408-INFRA-1.1')
check('infra release says behavior freeze',infra.get('change_scope',{}).get('behavior_freeze_preserved') is True)
check('cert declares infra hotfix',c.get('infra_hotfix_preserved') is True)
check('cert infra QA',c.get('qa',{}).get('infra_function_boundary')=='22/22')

# Core product endpoints/runtimes remain present.
for rel in ['_worker.js','shared/config.js','shared/coveragefit-launch.js','shared/life-secure-submit.js','shared/local-attribution.js','local/data/catalog.json']:
    check(rel+' present',(ROOT/rel).is_file())
failed=[x for x in checks if not x['passed']]
out={'sprint':'408-UI-3.13','suite':'release_source_contract','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(ROOT/'UI3_13_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-3.13 Source QA: {out['passed']}/{out['total']} passed")
sys.exit(1 if failed else 0)
