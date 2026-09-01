#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from collections import Counter
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'UI4_2_INPUT_BASELINE.json').read_text())
checks=[]
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def check(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)

for rel in ['shared/homepage-editorial.css','SPRINT-408-UI-4.2.md','408-UI-4-ROADMAP.md']:
    check('exists '+rel,(ROOT/rel).exists())

soup=BeautifulSoup((ROOT/'index.html').read_text(),'html.parser')
check('UI42 meta hook',soup.find('meta',attrs={'name':'408farmers-homepage-editorial','content':'408-UI-4.2'}) is not None)
check('UI42 css hook',len(soup.find_all('link',href='/shared/homepage-editorial.css?v=408-UI-4.2'))==1)
check('UI4.1 retained',len(soup.find_all('link',href='/shared/editorial-platform.css?v=408-UI-4.1'))==1 and len(soup.find_all('script',src='/shared/editorial-platform.js?v=408-UI-4.1'))==1)
check('UI3 foundation exactly once',len(soup.find_all('script',src='/shared/ui-3-foundation.js?v=408-UI-3.1'))==1)
# UI3 must load before UI4 on homepage so the UI4 shared runtime can enhance created nav/header.
scripts=[x.get('src') for x in soup.find_all('script',src=True)]
check('UI3 before UI4 runtime',scripts.index('/shared/ui-3-foundation.js?v=408-UI-3.1') < scripts.index('/shared/editorial-platform.js?v=408-UI-4.1'))

main=soup.select_one('main.ui42-home-main')
check('homepage main editorial marker',main is not None)
check('one h1',len(soup.find_all('h1'))==1)
check('identity h1 retained',soup.find('h1') and soup.find('h1').get_text(' ',strip=True)=='Insurance That Fits.')
hero=soup.select_one('.ui42-hero-shell.ui4-editorial-hero')
check('three-zone hero shell',hero is not None)
check('hero editorial copy zone',hero is not None and hero.select_one('.ui4-editorial-hero__copy') is not None)
check('hero contextual media zone',hero is not None and hero.select_one('.ui4-editorial-hero__media') is not None)
check('hero situation action zone',hero is not None and hero.select_one('.ui4-editorial-hero__action .ui4-action-panel') is not None)
check('not-a-quote identity retained','Start with a Coverage Review.' in hero.get_text(' ',strip=True) and 'Not a quote.' in hero.get_text(' ',strip=True))
check('context image real existing asset',hero.select_one('img[src="/shared/assets/home.jpg"]') is not None)
check('right surface situation-first',len(hero.select('.ui42-quick-routes a[href]'))==3 and 'What changed?' in hero.select_one('.ui42-situation-panel').get_text(' ',strip=True))
check('no generic lead form on homepage hero',hero.find('form') is None)
check('Dylan relationship band',soup.select_one('.ui42-relationship-band') is not None)
check('relationship SMS',soup.select_one('.ui42-relationship-band a[href^="sms:"]') is not None)
check('relationship phone',soup.select_one('.ui42-relationship-band a[href^="tel:"]') is not None)

# Original conversion identity and route contracts remain available.
chooser=soup.find('h2',id='platform-title')
check('primary chooser retained',chooser is not None and chooser.get_text(' ',strip=True)=='What brought you here today?')
sit=soup.select('.ui321-situation-grid a[href]')
check('six certified situation routes',len(sit)==6)
required=['buyer/','score/','auto-bundle/','contact/?intent=business','contact/?intent=landlord','life/']
for href in required: check('situation '+href,href in [a.get('href') for a in sit])
secondary=soup.select('.ui321-secondary-products .ui32-product-card[href]')
check('four secondary products',len(secondary)==4)
for href in ['home/','auto-bundle/','buyer/','life/']: check('secondary '+href,href in [a.get('href') for a in secondary])
check('CoverageFit bridge retained',soup.select_one('.ui321-coveragefit-bridge') is not None)
check('CoverageFit story retained',soup.find('section',id='coveragefit') is not None)
check('something changed psychology','Insurance usually gets reviewed after something changes.' in soup.get_text(' ',strip=True))
check('professional routes retained',len(soup.select('.ui42-professional-grid a[href]'))==4)
check('Local source module retained',soup.select_one('.ui32-local-card') is not None)
check('agent source module retained',soup.select_one('.ui32-agent-grid') is not None)
check('source footer retained',soup.find('footer',class_='hub-footer') is not None)

# Baseline href and tracked-anchor contracts must not disappear. Additions are allowed.
old_h=Counter(BASE['homepage_hrefs']); new_h=Counter(a.get('href') for a in soup.find_all('a',href=True))
missing_h=old_h-new_h
check('all baseline href destinations retained',sum(missing_h.values())==0,str(list(missing_h.items())[:10]))
old_t=Counter(tuple(x) for x in BASE['homepage_tracked_anchors'])
new_t=Counter((a.get('data-track-event'),a.get('data-track-location'),a.get('data-track-label'),a.get('href')) for a in soup.find_all('a',href=True) if a.get('data-track-event'))
missing_t=old_t-new_t
check('all baseline tracked anchors retained',sum(missing_t.values())==0,str(list(missing_t.items())[:10]))

# No unsupported mockup claims introduced.
text=soup.get_text(' ',strip=True).lower()
for bad in ['we shop top-rated carriers','serving our community since 1974','guaranteed savings','guaranteed discount','instant approval']:
    check('no unsupported claim '+bad,bad not in text)

# All non-homepage public HTML remains exact to UI4.1 input.
for rel,old in BASE['non_target_public_html_sha256'].items():
    p=ROOT/rel
    check('non-target exists '+rel,p.exists())
    if p.exists(): check('non-target exact '+rel,sha(p)==old)
# Life and protected runtimes stay exact.
for rel,old in BASE['life_file_sha256'].items(): check('life exact '+rel,sha(ROOT/rel)==old)
for rel,old in BASE['protected_sha256'].items(): check('protected exact '+rel,sha(ROOT/rel)==old)

css=(ROOT/'shared/homepage-editorial.css').read_text()
for token in ['ui42-hero-shell','ui42-situation-panel','ui42-relationship-band','ui42-situation-grid','ui42-method-steps','ui42-reason-grid','ui42-professional-grid','--ui4-gold-700','var(--ui3-red)']:
    check('css token '+token,token in css)
for bp in ['@media(max-width:1120px)','@media(max-width:860px)','@media(max-width:620px)']:
    check('responsive '+bp,bp in css)
check('reduced motion', 'prefers-reduced-motion' in css)

road=(ROOT/'408-UI-4-ROADMAP.md').read_text()
check('roadmap 4.2 complete','408-UI-4.2 — Homepage Editorial Convergence — COMPLETE' in road)
check('roadmap next 4.3','408-UI-4.3 — Home + Bundle Editorial Convergence' in road)

passed=sum(x['passed'] for x in checks)
out={'sprint':'408-UI-4.2','suite':'homepage_editorial_source_contract','total':len(checks),'passed':passed,'failed':len(checks)-passed,'missing_hrefs':list(missing_h.items()),'missing_tracks':[list(k)+[v] for k,v in missing_t.items()],'checks':checks}
(ROOT/'UI4_2_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-4.2 QA: {passed}/{len(checks)} passed')
sys.exit(0 if passed==len(checks) else 1)
