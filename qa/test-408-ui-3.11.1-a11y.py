#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import json,re,sys
ROOT=Path(__file__).resolve().parents[1]
PAGES=['home/index.html','auto-bundle/index.html','buyer/index.html','tech/index.html','teachers/index.html','engineers/index.html','healthcare/index.html','life/index.html']
checks=[]
def check(name,cond):
    checks.append({'name':name,'passed':bool(cond)})
    if not cond: print('FAIL',name)
for rel in PAGES:
    s=BeautifulSoup((ROOT/rel).read_text(errors='ignore'),'html.parser')
    ids={}
    for t in s.find_all(attrs={'id':True}): ids[t['id']]=ids.get(t['id'],0)+1
    check(rel+' single h1',len(s.find_all('h1'))==1)
    check(rel+' single main',len(s.find_all('main'))==1)
    check(rel+' unique ids',all(v==1 for v in ids.values()))
    check(rel+' all images alt',all(i.has_attr('alt') for i in s.find_all('img')))
    positive=[]; badrefs=[]; unlabeled=[]
    for t in s.find_all(True):
        ti=t.get('tabindex')
        if ti and re.fullmatch(r'-?\d+',ti) and int(ti)>0: positive.append(t.name)
        for attr in ('aria-labelledby','aria-describedby','aria-controls'):
            for ref in (t.get(attr,'') or '').split():
                if ref not in ids: badrefs.append(attr+':'+ref)
    for t in s.find_all(['input','select','textarea']):
        typ=(t.get('type') or '').lower()
        if typ in ('hidden','submit','button','reset'): continue
        label=t.get('aria-label') or t.get('aria-labelledby')
        if not label and t.get('id'): label=s.find('label',attrs={'for':t['id']})
        if not label and t.find_parent('label'): label=True
        if not label: unlabeled.append(t.get('name') or t.name)
    check(rel+' no positive tabindex',not positive)
    check(rel+' aria refs valid',not badrefs)
    check(rel+' controls labeled',not unlabeled)
failed=[x for x in checks if not x['passed']]
result={'sprint':'408-UI-3.11.1','suite':'campaign_entry_accessibility_delta','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(ROOT/'UI3_11_1_ACCESSIBILITY_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.11.1 Accessibility delta QA: {result['passed']}/{result['total']} passed")
sys.exit(1 if failed else 0)
