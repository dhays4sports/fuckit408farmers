#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
CONTRACT=json.loads((ROOT/'UI3_10_MOBILE_INTERACTION_CONTRACT.json').read_text())
checks=[]
def check(name,cond):
    checks.append({'name':name,'passed':bool(cond)})
    if not cond: print('FAIL',name)

css=(ROOT/CONTRACT['mobile_stylesheet']).read_text()
check('sprint doc exists',(ROOT/'SPRINT-408-UI-3.10.md').exists())
check('contract exists',(ROOT/'UI3_10_MOBILE_INTERACTION_CONTRACT.json').exists())
check('mobile stylesheet exists',(ROOT/'shared/mobile-interaction.css').exists())
for token in [
  'safe-area-inset-top','safe-area-inset-bottom','100dvh','pointer:coarse','touch-action:manipulation',
  'font-size:16px','scroll-margin-top','scroll-margin-bottom','overscroll-behavior:contain',
  'max-height:540px','orientation:landscape','professional-program-switcher','local-filter-scroll',
  'local-redemption-dialog','min-height:44px'
]:
    check('mobile css contains '+token,token in css)
check('no sticky submit overlay',not re.search(r'position\s*:\s*fixed[^}]{0,260}(submit|primary|cta)',css,re.I|re.S))
check('life ops excluded','life-ops/index.html' in CONTRACT['excluded'])

for rel in CONTRACT['public_pages']:
    p=ROOT/rel; txt=p.read_text(errors='ignore'); soup=BeautifulSoup(txt,'html.parser')
    vp=soup.find('meta',attrs={'name':'viewport'})
    check(rel+' exists',p.exists())
    check(rel+' ui mobile marker','408farmers-ui-mobile' in txt and '408-UI-3.10' in txt)
    check(rel+' mobile css linked','/shared/mobile-interaction.css?v=408-UI-3.10' in txt)
    check(rel+' viewport fit',vp is not None and 'viewport-fit=cover' in (vp.get('content') or ''))
    check(rel+' foundation preserved','ui-3-foundation.css' in txt)
    check(rel+' foundation runtime preserved','ui-3-foundation.js' in txt)

# Exact form contract preservation.
for rel,expected in CONTRACT['form_contracts'].items():
    soup=BeautifulSoup((ROOT/rel).read_text(errors='ignore'),'html.parser')
    got=[]
    for f in soup.find_all('form'):
        fields=[]
        for el in f.find_all(['input','select','textarea','button']):
            fields.append({
                'tag':el.name,'type':el.get('type',''),'name':el.get('name',''),
                'required':el.has_attr('required'),'value':el.get('value','') if el.name=='input' and el.get('type')=='hidden' else ''
            })
        got.append({'id':f.get('id',''),'action':f.get('action',''),'method':f.get('method',''),'success':f.get('data-success',''),'fields':fields})
    check(rel+' form contract preserved',got==expected)

for item in CONTRACT['protected_runtime_hashes']:
    p=ROOT/item['path']
    got=hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else ''
    check(item['path']+' runtime hash',got==item['sha256'])

# Internal links: use same conservative path logic as public package QA.
broken=[]; count=0
for rel in CONTRACT['public_pages']:
    p=ROOT/rel; soup=BeautifulSoup(p.read_text(errors='ignore'),'html.parser')
    for a in soup.find_all('a',href=True):
        href=a['href'].strip()
        if not href or href.startswith(('#','tel:','sms:','mailto:','http://','https://','javascript:')): continue
        count+=1
        path=href.split('#',1)[0].split('?',1)[0]
        if not path: continue
        target=(ROOT/path.lstrip('/')) if path.startswith('/') else (p.parent/path).resolve()
        if path.endswith('/'):
            target=target/'index.html'
        elif target.is_dir():
            target=target/'index.html'
        elif not target.suffix:
            if (target/'index.html').exists(): target=target/'index.html'
            elif target.with_suffix('.html').exists(): target=target.with_suffix('.html')
        if not target.exists(): broken.append({'source':rel,'href':href})
check('internal links have no broken targets',len(broken)==0)

failed=[c for c in checks if not c['passed']]
result={'sprint':'408-UI-3.10','suite':'source_contract','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'public_pages':len(CONTRACT['public_pages']),'internal_links_checked':count,'broken_links':broken,'checks':checks}
(ROOT/'UI3_10_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.10 source QA: {result['passed']}/{result['total']} passed; links {count}, broken {len(broken)}")
sys.exit(1 if failed else 0)
