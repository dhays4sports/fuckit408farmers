#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'UI4_10_INPUT_BASELINE.json').read_text())
checks=[]
def check(name,cond,detail=''):
    checks.append({'name':name,'passed':bool(cond),'detail':detail if not cond else ''})
    if not cond: print('FAIL',name,detail)
def sha(rel): return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()

# 4.9 deployable/runtime product must be byte-frozen in 4.10.
for rel,want in BASE['runtime_product_files'].items():
    p=ROOT/rel
    check('runtime exists '+rel,p.exists())
    if p.exists(): check('runtime exact '+rel,sha(rel)==want)

# Explicit Life and infrastructure audits are duplicated intentionally so the release record
# can state those boundaries independently of the wider runtime freeze.
for rel,want in BASE['life_exact_files'].items():
    check('Life exact '+rel,(ROOT/rel).exists() and sha(rel)==want)
for rel,want in BASE['infra_exact_files'].items():
    check('INFRA exact '+rel,(ROOT/rel).exists() and sha(rel)==want)
for rel,want in BASE['critical_flow_files'].items():
    check('critical flow exact '+rel,(ROOT/rel).exists() and sha(rel)==want)

# Required surface inventory.
required=[
 'index.html','home/index.html','auto-bundle/index.html','buyer/index.html',
 'healthcare/index.html','teachers/index.html','tech/index.html','engineers/index.html',
 'local/index.html','local/detail/index.html','local/join/index.html','local/join/thank-you.html',
 'contact/index.html','score/index.html','home/thank-you.html','auto-bundle/thank-you.html','buyer/thank-you.html',
 'healthcare/thank-you.html','teachers/thank-you.html','tech/thank-you.html','engineers/thank-you.html',
 'life/index.html','life/thank-you.html','life-ops/index.html','_worker.js','_routes.json','_headers','_redirects'
]
for rel in required: check('required surface '+rel,(ROOT/rel).exists())

# Current-generation regression evidence. These artifacts were rerun from this exact 4.9 input.
expected={
 'UI4_9_QA.json':(374,374,0),
 'UI4_9_BROWSER_QA.json':(62,62,0),
 'UI4_9_PERFORMANCE_BROWSER_QA.json':(31,31,0),
 'UI4_8_QA.json':(161,161,0),
 'UI4_8_BROWSER_QA.json':(256,256,0),
 'UI4_7_QA.json':(142,142,0),
 'UI4_7_BROWSER_QA.json':(110,110,0),
 'UI3_12_E2E_QA.json':(59,59,0),
 'UI3_13_JS_SYNTAX_QA.json':(44,44,0),
}
for rel,(total,passed,failed) in expected.items():
    p=ROOT/rel; check(rel+' exists',p.exists())
    try: d=json.loads(p.read_text()) if p.exists() else {}
    except Exception as e: d={}; check(rel+' valid JSON',False,str(e))
    if d:
        check(rel+' total',d.get('total')==total,str(d.get('total')))
        check(rel+' passed',d.get('passed')==passed,str(d.get('passed')))
        check(rel+' failed',d.get('failed')==failed,str(d.get('failed')))

# Link integrity has its own checked/broken schema.
links=json.loads((ROOT/'UI3_13_LINK_QA.json').read_text())
check('links checked',links.get('checked')==856,str(links.get('checked')))
check('links broken zero',links.get('broken')==0,str(links.get('broken')))

# Life browser behavior is current behavior evidence; exact hashes above are the source preservation evidence.
life=json.loads((ROOT/'LIFE1_7_BROWSER_QA.json').read_text())
check('Life browser passed',life.get('passed')==19 and life.get('failed')==0,str({k:life.get(k) for k in ['passed','failed']}))

# Current release records and deployment boundary.
for rel in ['SPRINT-408-UI-4.10.md','UI4_10_DEPLOYMENT_SMOKE_RUNBOOK.md','UI4_10_REGRESSION_MATRIX.json','UI4_10_RELEASE_CERTIFICATION.json']:
    check(rel+' packaged',(ROOT/rel).exists())
version=(ROOT/'VERSION').read_text().strip()
check('VERSION advanced to 4.10',version.startswith('408-UI-4.10'),version)
runbook=(ROOT/'UI4_10_DEPLOYMENT_SMOKE_RUNBOOK.md').read_text()
for token in ['Static shell + assets','Cloudflare static / Function invocation boundary','Home + deep/QR routes','Lead submission canary','Post-lead + CoverageFit','Professional Programs','Local','Life exact-preservation smoke','Production closeout']:
    check('runbook section '+token,token in runbook)
matrix=json.loads((ROOT/'UI4_10_REGRESSION_MATRIX.json').read_text())
check('matrix pass',matrix.get('status')=='pass')
check('matrix deployment pending',matrix.get('deployment_activation')=='pending_post_deploy_smoke')
check('matrix documents legacy exceptions',len(matrix.get('superseded_historical_harnesses') or [])>=5)
cert=json.loads((ROOT/'UI4_10_RELEASE_CERTIFICATION.json').read_text())
check('release certified',cert.get('status')=='certified')
check('UI4 program complete',cert.get('ui4_program_status')=='complete')
check('release deployment pending',cert.get('deployment_activation')=='pending_post_deploy_smoke')
check('release no functional changes',cert.get('functional_changes') is False and cert.get('customer_facing_changes') is False)
road=(ROOT/'408-UI-4-ROADMAP.md').read_text(); master=(ROOT/'408-UI-ROADMAP.md').read_text()
check('UI4 roadmap closes 4.10','408-UI-4.10 — Functional Regression + Production Certification — COMPLETE' in road)
check('master roadmap closes UI4','UI-4.x status' in master and 'DEPLOYABLE-CERTIFIED' in master)

out={'sprint':'408-UI-4.10','suite':'functional_production_source_freeze','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks}
(ROOT/'UI4_10_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-4.10 QA: {out['passed']}/{out['total']} passed")
sys.exit(1 if out['failed'] else 0)
