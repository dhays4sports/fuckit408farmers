#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
base=json.loads((ROOT/'UI3_13_INFRA1_1_PRESERVATION_BASELINE.json').read_text())
checks=[]
for item in base['files']:
    p=ROOT/item['path']
    ok=p.is_file() and p.stat().st_size==item['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==item['sha256']
    checks.append({'name':'preserve '+item['path'],'passed':ok,'detail':'' if ok else 'missing or changed'})
    if not ok: print('FAIL',item['path'])
failed=[x for x in checks if not x['passed']]
out={'sprint':'408-UI-3.13','suite':'infra1_1_exact_preservation','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(ROOT/'UI3_13_INFRA_PRESERVATION_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-3.13 INFRA-1.1 Preservation QA: {out['passed']}/{out['total']} passed")
sys.exit(1 if failed else 0)
