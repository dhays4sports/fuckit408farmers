#!/usr/bin/env python3
from pathlib import Path
import subprocess,re,json,sys
ROOT=Path(__file__).resolve().parents[1]
r=subprocess.run([sys.executable,str(ROOT/'qa/check-links.py')],cwd=ROOT,capture_output=True,text=True)
outtxt=(r.stdout or '')+(r.stderr or '')
m=re.search(r'checked=(\d+)\s+broken=(\d+)',outtxt)
checked=int(m.group(1)) if m else 0; broken=int(m.group(2)) if m else 999
out={'sprint':'408-UI-3.13','suite':'internal_links_and_assets','checked':checked,'broken':broken,'total':checked,'passed':checked-broken if checked>=broken else 0,'failed':broken,'raw':outtxt.strip()}
(ROOT/'UI3_13_LINK_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-3.13 Link QA: {checked} checked / {broken} broken')
sys.exit(0 if r.returncode==0 and broken==0 else 1)
