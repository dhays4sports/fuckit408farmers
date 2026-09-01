#!/usr/bin/env python3
from pathlib import Path
from collections import Counter
from bs4 import BeautifulSoup
from urllib.parse import urlsplit
import hashlib,json,sys,re
ROOT=Path(__file__).resolve().parents[1]
CONTRACT=json.loads((ROOT/'UI3_2_1_HOMEPAGE_IDENTITY_CONTRACT.json').read_text())
checks=[]
def check(name,cond):
    checks.append({'name':name,'passed':bool(cond)})
    if not cond: print('FAIL',name)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def txt(p): return p.read_text(errors='ignore')

check('identity overlay exists',(ROOT/'shared/homepage-conversion-identity.css').exists())
check('sprint doc exists',(ROOT/'SPRINT-408-UI-3.2.1.md').exists())
check('roadmap exists',(ROOT/'408-UI-ROADMAP.md').exists())
new=BeautifulSoup(txt(ROOT/'index.html'),'html.parser')
check('UI321 meta hook',new.find('meta',attrs={'name':'408farmers-homepage-identity-alignment','content':'408-UI-3.2.1'}) is not None)
check('UI321 css hook',len(new.find_all('link',href='/shared/homepage-conversion-identity.css?v=408-UI-3.2.1'))==1)
check('UI32 css retained',len(new.find_all('link',href='/shared/homepage-platform.css?v=408-UI-3.2'))==1)
check('UI31 foundation retained',len(new.find_all('link',href='/shared/ui-3-foundation.css?v=408-UI-3.1'))==1 and len(new.find_all('script',src='/shared/ui-3-foundation.js?v=408-UI-3.1'))==1)
check('one h1',len(new.find_all('h1'))==1)
check('Insurance That Fits restored',new.find('h1') and new.find('h1').get_text(' ',strip=True)==CONTRACT['required_identity']['h1'])
hero=new.select_one('.ui32-hero-copy')
check('Coverage Review not quote restored',hero is not None and 'Start with a Coverage Review.' in hero.get_text(' ',strip=True) and 'Not a quote.' in hero.get_text(' ',strip=True))
check('secondary hero CTA situation-first',new.find('a',href='#start',string=re.compile('Choose what brought me here')) is not None)
chooser=new.find('h2',id='platform-title')
check('primary chooser restored',chooser is not None and chooser.get_text(' ',strip=True)==CONTRACT['required_identity']['primary_chooser'])
# Situation-first routing.
sit=new.select('.ui321-situation-grid a[href]')
sit_hrefs=[a.get('href') for a in sit]
check('six primary situation routes',len(sit)==6)
for href in CONTRACT['required_identity']['situation_routes']:
    check('situation route '+href,href in sit_hrefs)
check('situation labels not product taxonomy',all((a.select_one('span') and a.select_one('span').get_text(' ',strip=True) in [
    'Buying a home','Reviewing coverage','Shopping auto + bundle','Protecting a business','Reviewing a rental','Protecting my family']) for a in sit))
# CoverageFit centrality.
check('CoverageFit hero identity','CoverageFit' in new.select_one('.ui32-hero-card').get_text(' ',strip=True))
check('CoverageFit bridge exists',new.select_one('.ui321-coveragefit-bridge') is not None)
check('CoverageFit section anchored',new.find('section',id='coveragefit') is not None)
sections=[x.get('id') or 'unnamed' for x in new.find_all('section')]
check('CoverageFit appears before reasons',new.find('section',id='coveragefit').sourceline < new.find('h2',id='reasons-title').sourceline)
# Product navigation retained but secondary.
secondary=new.select('.ui321-secondary-products .ui32-product-card[href]')
secondary_hrefs=[a.get('href') for a in secondary]
check('four secondary product routes',len(secondary)==4)
for href in CONTRACT['required_identity']['secondary_product_routes']:
    check('secondary product route '+href,href in secondary_hrefs)
# Something-changed psychology remains.
page_text=new.get_text(' ',strip=True)
check('something changed psychology','Insurance usually gets reviewed after something changes.' in page_text)
check('premium increased reason','My premium increased' in page_text)
check('renewal approaching reason','My renewal is approaching' in page_text)
check('life changed reason','Life looks different now' in page_text)
# New visual system/local/footer retained.
check('Local integration retained',new.select_one('.ui32-local-card') is not None)
check('agent module retained',new.select_one('.ui32-agent-grid') is not None)
check('source header retained',new.find('header',class_='site-header') is not None)
check('source footer retained',new.find('footer',class_='hub-footer') is not None)
# Every baseline homepage href and tracked anchor contract remains available.
base_counts=Counter(CONTRACT['homepage_baseline_href_counts'])
new_counts=Counter(a.get('href') for a in new.find_all('a',href=True))
missing=base_counts-new_counts
check('all baseline href destinations preserved',sum(missing.values())==0)
new_tracks=Counter((a.get('data-track-event'),a.get('data-track-location'),a.get('data-track-label'),a.get('href')) for a in new.find_all('a',href=True) if a.get('data-track-event'))
base_tracks=Counter(tuple(x) for x in CONTRACT['homepage_baseline_tracked_anchors'])
missing_tracks=base_tracks-new_tracks
check('all baseline tracked anchors preserved',sum(missing_tracks.values())==0)
# Everything except homepage + new UI321 docs/assets stays byte-identical to UI33 baseline contract.
for rel,h in CONTRACT['unchanged_public_html_sha256'].items():
    p=ROOT/rel
    check(rel+':exists',p.exists())
    if p.exists(): check(rel+':unchanged',sha(p)==h)
for rel,h in CONTRACT['protected_runtime_sha256'].items():
    p=ROOT/rel
    check(rel+':exists',p.exists())
    if p.exists(): check(rel+':protected unchanged',sha(p)==h)
# Overlay consumes existing tokens and stays narrow.
css=txt(ROOT/'shared/homepage-conversion-identity.css')
for token in ['var(--ui3-navy-950)','var(--ui3-red)','var(--ui3-line)','var(--ui3-muted)']:
    check('overlay token '+token,token in css)
for sel in ['.ui321-situation-grid','.ui321-coveragefit-bridge','.ui321-secondary-products','.ui321-coveragefit-section']:
    check('overlay selector '+sel,sel in css)
check('responsive phone breakpoint','@media(max-width:620px)' in css)
check('reduced motion support','prefers-reduced-motion' in css)
# Internal links.
broken=[];total=0
for p in ROOT.rglob('*.html'):
    rel=p.relative_to(ROOT).as_posix()
    if rel.startswith(('qa/fixtures/','life-ops/')): continue
    soup=BeautifulSoup(txt(p),'html.parser')
    for a in soup.find_all('a',href=True):
        href=a['href'].strip()
        if not href or href.startswith(('#','mailto:','tel:','sms:','javascript:','http://','https://')): continue
        path=urlsplit(href).path
        if not path: continue
        total+=1
        target=ROOT/path.lstrip('/') if path.startswith('/') else (p.parent/path).resolve()
        cand=[target]
        if path.endswith('/') or target.is_dir(): cand.append(target/'index.html')
        elif target.suffix=='': cand += [Path(str(target)+'.html'),target/'index.html']
        if not any(c.exists() for c in cand): broken.append((rel,href))
check('internal links checked >=120',total>=120)
check('internal links broken 0',len(broken)==0)
result={'sprint':'408-UI-3.2.1','suite':'source_behavior_contract','total':len(checks),'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'missing_hrefs':list(missing.items()),'missing_tracks':[list(k)+[v] for k,v in missing_tracks.items()],'internal_links_checked':total,'broken_links':broken[:20],'checks':checks}
(ROOT/'UI3_2_1_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.2.1 QA: {result['passed']}/{result['total']} passed; internal links {total}, broken {len(broken)}")
sys.exit(1 if result['failed'] else 0)
