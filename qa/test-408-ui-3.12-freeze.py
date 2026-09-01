#!/usr/bin/env python3
from pathlib import Path
import json, hashlib, sys
ROOT=Path(__file__).resolve().parents[1]

def sha(p):
    h=hashlib.sha256(); h.update(p.read_bytes()); return h.hexdigest()

def verify(baseline_name,out_name,suite):
    b=json.loads((ROOT/baseline_name).read_text())
    checks=[]
    for item in b['files']:
        p=ROOT/item['path']
        ok=p.is_file() and p.stat().st_size==item['bytes'] and sha(p)==item['sha256']
        checks.append({'path':item['path'],'passed':ok})
    failed=[x for x in checks if not x['passed']]
    out={'sprint':'408-UI-3.12','suite':suite,'total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
    (ROOT/out_name).write_text(json.dumps(out,indent=2)+'\n')
    print(f"{suite}: {out['passed']}/{out['total']} passed")
    return not failed

ok1=verify('UI3_12_BEHAVIOR_FREEZE_BASELINE.json','UI3_12_BEHAVIOR_FREEZE_QA.json','behavior_critical_freeze')
ok2=verify('UI3_12_PRODUCT_FREEZE_BASELINE.json','UI3_12_PRODUCT_FREEZE_QA.json','expanded_product_surface_freeze')
sys.exit(0 if ok1 and ok2 else 1)
