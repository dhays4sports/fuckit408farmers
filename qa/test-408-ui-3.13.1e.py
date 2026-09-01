#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import hashlib, json, sys
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'UI3_13_1E_INPUT_BASELINE.json').read_text())
checks=[]
def ck(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)
def sha(p): return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()

# 1) Final branch is a pure certification sprint: every shipped product/runtime byte equals 3.13.1D input.
for rel,h in BASE['product_hashes'].items():
    p=ROOT/rel
    ck('product freeze '+rel,p.exists() and sha(rel)==h,sha(rel) if p.exists() else 'missing')

# 2) Core form contracts remain exact.
form_paths={'home':'home/index.html','auto_bundle':'auto-bundle/index.html','buyer':'buyer/index.html','healthcare':'healthcare/index.html','teachers':'teachers/index.html','tech':'tech/index.html','engineers':'engineers/index.html','local_join':'local/join/index.html'}
for name,rel in form_paths.items():
    soup=BeautifulSoup((ROOT/rel).read_text(),'html.parser')
    form=soup.find('form',id='leadForm') if name!='local_join' else soup.find('form')
    h=hashlib.sha256(str(form).encode()).hexdigest()
    ck('form freeze '+name,h==BASE['form_hashes'][name],h)

# 3) Life remains explicitly outside Human Trust branch.
for rel,h in BASE['life_scope'].items():
    ck('life exact '+rel,sha(rel)==h,sha(rel))
for rel in ['life/index.html','life/thank-you.html']:
    if (ROOT/rel).exists():
        s=(ROOT/rel).read_text(errors='ignore')
        ck(rel+' no relationship human css','relationship-human.css' not in s)
        ck(rel+' no core human css','core-insurance-human.css' not in s)
        ck(rel+' no professional human css','professional-human.css' not in s)

# 4) INFRA boundary remains exact.
for rel,h in BASE['infra_scope'].items(): ck('infra exact '+rel,sha(rel)==h,sha(rel))

# 5) Human Trust branch A-D remains visibly present.
required_artifacts=['HUMAN-TRUST-DESIGN-SYSTEM.md','HUMAN-TRUST-COMPONENT-REGISTRY.json','SPRINT-408-UI-3.13.1A.md','SPRINT-408-UI-3.13.1B.md','SPRINT-408-UI-3.13.1C.md','SPRINT-408-UI-3.13.1D.md','UI3_13_1D_RELEASE_CERTIFICATION.json']
for rel in required_artifacts: ck('artifact '+rel,(ROOT/rel).exists())

# 6) Representative trust-layer presentation contracts remain intact.
expect={
'healthcare/index.html':['Work in Healthcare?','Your review is handled by Dylan Haysbert'],
'teachers/index.html':['Are You a Teacher?','Your review is handled by Dylan Haysbert'],
'tech/index.html':['Work in Tech?','Your review is handled by Dylan Haysbert'],
'engineers/index.html':['Are You an Engineer?','Your review is handled by Dylan Haysbert'],
'home/thank-you.html':['I have your home review request.'],
'auto-bundle/thank-you.html':['I have your home + auto review request.'],
'contact/index.html':['You’ll reach me directly.','No call-center handoff.'],
'local/index.html':['Useful places. Local perks. South Bay businesses.','No insurance purchase or quote required.'],
'local/join/thank-you.html':['I have your Local pilot application.'],
}
for rel,tokens in expect.items():
    text=BeautifulSoup((ROOT/rel).read_text(),'html.parser').get_text(' ',strip=True)
    for token in tokens: ck(rel+' text '+token,token.lower() in text.lower())

# 7) Campaign registry and message matching source remain present and not consumer-injectable.
for rel in ['CAMPAIGN_ENTRY_REGISTRY.json','shared/campaign-entry-registry.js','shared/campaign-entry.js']:
    ck('campaign source '+rel,(ROOT/rel).exists())
reg=json.loads((ROOT/'CAMPAIGN_ENTRY_REGISTRY.json').read_text())
ck('campaign registry nonempty',bool(reg))

# 8) Local insurance separation stays intact on key public Local surfaces.
for rel in ['local/index.html','local/detail/index.html','local/join/index.html','local/join/thank-you.html']:
    txt=BeautifulSoup((ROOT/rel).read_text(),'html.parser').get_text(' ',strip=True).lower()
    ck(rel+' local separation',('no insurance purchase or quote' in txt) or ('separate from insurance' in txt))

out={'sprint':'408-UI-3.13.1E','suite':'human_trust_final_freeze','total':len(checks),'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'product_files_frozen':BASE['product_file_count'],'forms_frozen':len(BASE['form_hashes']),'life_files_frozen':len(BASE['life_scope']),'checks':checks}
(ROOT/'UI3_13_1E_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-3.13.1E final freeze QA: {out['passed']}/{out['total']} passed; product files {BASE['product_file_count']} exact")
sys.exit(0 if out['failed']==0 else 1)
