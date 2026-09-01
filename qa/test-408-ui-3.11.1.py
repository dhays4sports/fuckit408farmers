#!/usr/bin/env python3
from pathlib import Path
import json,re,sys,subprocess
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,cond):
    checks.append({'name':name,'passed':bool(cond)})
    if not cond: print('FAIL',name)

pages=['home/index.html','auto-bundle/index.html','buyer/index.html','tech/index.html','teachers/index.html','engineers/index.html','healthcare/index.html','life/index.html']
for rel in pages:
    txt=(ROOT/rel).read_text()
    check(rel+' build marker','408farmers-campaign-entry-build' in txt and '408-UI-3.11.1' in txt)
    check(rel+' registry loaded','campaign-entry-registry.js?v=408-UI-3.11.1' in txt)
    check(rel+' runtime loaded','campaign-entry.js?v=408-UI-3.11.1' in txt)
    check(rel+' css loaded','campaign-entry.css?v=408-UI-3.11.1' in txt)

for rel in ['auto-bundle/index.html','tech/index.html','teachers/index.html','engineers/index.html','healthcare/index.html']:
    txt=(ROOT/rel).read_text()
    for hook in ['data-campaign-entry-eyebrow','data-campaign-entry-title','data-campaign-entry-lead','data-campaign-entry-form-kicker','data-campaign-entry-form-title','data-campaign-entry-submit']:
        check(rel+' '+hook,hook in txt)

buyer=(ROOT/'buyer/index.html').read_text()
for hook in ['data-campaign-entry-kicker','data-campaign-entry-title','data-campaign-entry-lead','data-campaign-entry-body','data-campaign-entry-start-online']:
    check('buyer '+hook,hook in buyer)

home=(ROOT/'home/index.html').read_text()
for hook in ['data-home-campaign-eyebrow','data-home-campaign-title','data-home-campaign-lead','data-home-campaign-copy','data-home-campaign-cta','data-home-campaign-reassurance']:
    check('home existing '+hook,hook in home)

registry=(ROOT/'shared/campaign-entry-registry.js').read_text()
runtime=(ROOT/'shared/campaign-entry.js').read_text()
check('registry current URL only','localStorage' not in registry and 'sessionStorage' not in registry)
check('runtime current URL only','localStorage' not in runtime and 'sessionStorage' not in runtime)
check('runtime no raw parameter injection','innerHTML' not in runtime)
check('unknown fallback represented',"active: false" in registry)
check('dynamic flyer delegated','home_flyer_dynamic' in registry and 'delegated: true' in registry)
check('Life delegated','life_campaign' in registry and 'delegated: true' in registry)

for doc in ['CAMPAIGN_ENTRY_REGISTRY.json','CAMPAIGN_MESSAGE_MATRIX.md','CAMPAIGN_CREATIVE_REFRESH_SPEC.md']:
    check(doc+' exists',(ROOT/doc).exists())

failed=[x for x in checks if not x['passed']]
result={'sprint':'408-UI-3.11.1','suite':'source_contract','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(ROOT/'UI3_11_1_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.11.1 Source QA: {result['passed']}/{result['total']} passed")
sys.exit(1 if failed else 0)
