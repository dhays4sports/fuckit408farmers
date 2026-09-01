#!/usr/bin/env python3
from pathlib import Path
import subprocess,json,sys
ROOT=Path(__file__).resolve().parents[1]
files=[]
for p in sorted((ROOT/'shared').glob('*.js')):
    files.append(p)
files.append(ROOT/'_worker.js')
checks=[]
for p in files:
    r=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
    checks.append({'path':p.relative_to(ROOT).as_posix(),'passed':r.returncode==0,'detail':'' if r.returncode==0 else (r.stderr or r.stdout).strip()})
failed=[x for x in checks if not x['passed']]
out={'sprint':'408-UI-3.13','suite':'runtime_javascript_syntax','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(ROOT/'UI3_13_JS_SYNTAX_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-3.13 JS Syntax QA: {out['passed']}/{out['total']} passed")
sys.exit(1 if failed else 0)
