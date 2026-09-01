#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
BASE=json.load(open(ROOT/'LOCAL_COMMUNITY_EDITORIAL_INPUT_BASELINE.json'))
checks=[]
def check(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

# Directory source contract.
src=(ROOT/'local/index.html').read_text(); s=BeautifulSoup(src,'html.parser')
check('directory marker',s.body.get('data-ui4-local')=='408-UI-4.6' and 'ui46-local-directory' in (s.body.get('class') or []))
check('directory css',s.find('link',href=lambda x:x and 'local-community-editorial.css' in x) is not None)
check('directory js',s.find('script',src=lambda x:x and 'local-community-editorial.js' in x) is not None)
hero=s.select_one('.ui46-local-hero')
check('directory hero',hero is not None)
check('directory hero copy',hero and hero.select_one('.ui46-local-hero__copy h1') is not None)
check('directory hero media',hero and hero.select_one('.ui46-local-hero__media img') is not None)
check('directory hero action',hero and hero.select_one('.ui46-local-category-panel') is not None)
buttons=s.select('[data-ui46-local-filter]')
check('four real category proxies',len(buttons)==4,str([b.get('data-ui46-local-filter') for b in buttons]))
check('supported category keys',{b.get('data-ui46-local-filter') for b in buttons}=={'all','eat-drink','home','auto'})
text=s.get_text(' ',strip=True).lower()
for forbidden in ['family & kids','health & wellness','shopping & retail','experiences','miles away','star rating']:
    check('no fabricated '+forbidden,forbidden not in text)
check('directory mechanics root',s.select_one('[data-local-directory]') is not None)
check('directory native filters preserved',len(s.select('[data-local-filter]'))==4)
check('explicit no purchase','no insurance purchase or quote required' in text)
check('editorial three',len(s.select('.ui46-local-editorial > article'))==3)
check('merchant recruitment',s.select_one('.ui46-local-merchant-cta a[href="/local/join/"]') is not None)

# Detail/join/thanks markers.
for rel,cls in [('local/detail/index.html','ui46-local-detail'),('local/join/index.html','ui46-local-join'),('local/join/thank-you.html','ui46-local-join-thanks')]:
    so=BeautifulSoup((ROOT/rel).read_text(),'html.parser')
    check(rel+' marker',so.body.get('data-ui4-local')=='408-UI-4.6' and cls in (so.body.get('class') or []))
    check(rel+' css',so.find('link',href=lambda x:x and 'local-community-editorial.css' in x) is not None)
    check(rel+' js',so.find('script',src=lambda x:x and 'local-community-editorial.js' in x) is not None)
    check(rel+' one h1',len(so.find_all('h1'))==1)

join=(ROOT/'local/join/index.html').read_text()
m=re.search(r'(<form\b[^>]*\bid="localMerchantJoinForm"[^>]*>.*?</form>)',join,re.S)
h=hashlib.sha256(m.group(1).encode()).hexdigest() if m else ''
check('join form exact',h==BASE['join_form_sha256'],f'{h} != {BASE["join_form_sha256"]}')
join_text=BeautifulSoup(join,'html.parser').get_text(' ',strip=True).lower()
check('join separation','separate from insurance' in join_text and 'does not require purchasing' in join_text)

# Protected Local runtime/data, Life, INFRA exact.
for group in ['protected_sha256','life_sha256','infra_sha256']:
    for rel,old in BASE[group].items():
        pp=ROOT/rel; check(group+' exists '+rel,pp.exists())
        if pp.exists(): check(group+' exact '+rel,sha(pp)==old)

css=(ROOT/'shared/local-community-editorial.css').read_text()
for token in ['ui46-local-hero','grid-template-columns:minmax(0,.86fr)','ui46-local-category-panel','local-directory-grid','ui46-local-editorial','local-detail-page','ui46-local-join-hero','var(--ui4-gold-500','var(--ui3-red','@media(max-width:860px)','prefers-reduced-motion','forced-colors:active']:
    check('css '+token,token in css)
js=(ROOT/'shared/local-community-editorial.js').read_text()
for token in ['data-ui46-local-filter','data-local-filter','scrollIntoView','MutationObserver']:
    check('js '+token,token in js)
road=(ROOT/'408-UI-4-ROADMAP.md').read_text()
check('roadmap 4.6 complete','408-UI-4.6 — Local Community Convergence — COMPLETE' in road)
check('roadmap next 4.7','408-UI-4.7 — Relationship + Completion Editorial Convergence' in road)
check('sprint doc',(ROOT/'SPRINT-408-UI-4.6.md').exists())
check('contract',(ROOT/'LOCAL_COMMUNITY_EDITORIAL_CONVERGENCE_CONTRACT.json').exists())
passed=sum(x['passed'] for x in checks)
out={'sprint':'408-UI-4.6','suite':'local_community_editorial_source','total':len(checks),'passed':passed,'failed':len(checks)-passed,'checks':checks}
(ROOT/'UI4_6_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-4.6 QA: {passed}/{len(checks)} passed')
sys.exit(0 if passed==len(checks) else 1)
