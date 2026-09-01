#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,cond,detail=''):
    checks.append({'name':name,'passed':bool(cond),'detail':'' if cond else str(detail)})
    if not cond: print('FAIL',name,detail)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

# Exact runtime/data/config freeze against the 408-INFRA-1.1 hotfix input (UI-3.12 + function-boundary routing).
base=json.loads((ROOT/'UI3_13_RUNTIME_FREEZE_BASELINE.json').read_text())
for item in base['files']:
    p=ROOT/item['path'];ok=p.is_file() and p.stat().st_size==item['bytes'] and sha(p)==item['sha256']
    check('runtime '+item['path'],ok,'missing/changed')

# Exact form structure/transport/required-field freeze.
def current_forms():
    forms=[]
    for p in sorted(ROOT.rglob('*.html')):
        rel=p.relative_to(ROOT).as_posix()
        if rel.startswith('qa/'): continue
        soup=BeautifulSoup(p.read_text(errors='ignore'),'html.parser')
        for idx,f in enumerate(soup.find_all('form')):
            fields=[]
            for el in f.find_all(['input','select','textarea','button']):
                if el.name=='button':
                    fields.append({'tag':'button','type':el.get('type','submit'),'name':el.get('name',''),'value':el.get('value',''),'required':el.has_attr('required')});continue
                item={'tag':el.name,'name':el.get('name',''),'type':el.get('type','') if el.name=='input' else '', 'required':el.has_attr('required')}
                if el.name=='select': item['options']=[o.get('value','') for o in el.find_all('option')]
                fields.append(item)
            forms.append({'path':rel,'index':idx,'id':f.get('id',''),'action':f.get('action',''),'method':f.get('method','get').lower(),'fields':fields})
    return forms
fb=json.loads((ROOT/'UI3_13_FORM_CONTRACT_BASELINE.json').read_text())['forms']
cf=current_forms()
check('form count frozen',len(cf)==len(fb),f'{len(cf)} != {len(fb)}')
for i,expected in enumerate(fb):
    actual=cf[i] if i<len(cf) else None
    check('form contract '+expected['path']+'#'+str(expected['index']),actual==expected,{'expected':expected,'actual':actual})

# Production product delta may touch metadata/picture delivery and three presentation CSS files only.
prod=json.loads((ROOT/'UI3_13_INPUT_PRODUCT_BASELINE.json').read_text())
old={x['path']:x for x in prod['files']}
changed=[];missing=[]
for rel,item in old.items():
    p=ROOT/rel
    if not p.exists(): missing.append(rel);continue
    if sha(p)!=item['sha256']: changed.append(rel)
allowed_changed={
 'index.html','home/index.html','auto-bundle/index.html','buyer/index.html','life/index.html','score/index.html',
 'tech/index.html','teachers/index.html','engineers/index.html','healthcare/index.html','contact/index.html','privacy.html','terms.html',
 'home/thank-you.html','auto-bundle/thank-you.html','buyer/thank-you.html','tech/thank-you.html','teachers/thank-you.html','engineers/thank-you.html','healthcare/thank-you.html',
 'shared/homepage-platform.css','shared/buyer-experience-ui.css','shared/life-campaign-platform.css','VERSION'
}
check('input product files not removed',not missing,missing)
unexpected=sorted(set(changed)-allowed_changed)
check('product changes limited to certified production-polish files',not unexpected,unexpected)
check('all changed product files are intentional',set(changed).issubset(allowed_changed),changed)
# New shipped product artifacts introduced by 3.13.
for rel in ['robots.txt','sitemap.xml','shared/assets/buyer-home-420.webp','shared/assets/buyer-home-595.webp','shared/assets/life-family-campaign-420.webp','shared/assets/life-family-campaign-705.webp']:
    check('new production artifact '+rel,(ROOT/rel).is_file())

failed=[c for c in checks if not c['passed']]
out={'sprint':'408-UI-3.13','suite':'behavior_form_and_product_delta_freeze','runtime_files':len(base['files']),'form_contracts':len(fb),'changed_input_product_files':changed,'allowed_product_changes':sorted(allowed_changed),'total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(ROOT/'UI3_13_FREEZE_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-3.13 Freeze QA: {out['passed']}/{out['total']} passed")
sys.exit(1 if failed else 0)
