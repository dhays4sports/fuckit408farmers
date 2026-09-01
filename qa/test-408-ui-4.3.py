#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'UI4_3_INPUT_BASELINE.json').read_text())
checks=[]
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def check(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)
def form_hash(rel):
    t=(ROOT/rel).read_text(); m=re.search(r'<form\b[^>]*id="leadForm"[^>]*>.*?</form>',t,re.S)
    return hashlib.sha256(m.group(0).encode()).hexdigest() if m else None

for rel in ['shared/home-bundle-editorial.css','SPRINT-408-UI-4.3.md','408-UI-4-ROADMAP.md']:
    check('exists '+rel,(ROOT/rel).exists())
for rel in ['home/index.html','auto-bundle/index.html']:
    s=BeautifulSoup((ROOT/rel).read_text(),'html.parser')
    check(rel+' meta',s.find('meta',attrs={'name':'408farmers-home-bundle-editorial','content':'408-UI-4.3'}) is not None)
    check(rel+' css',len(s.find_all('link',href='/shared/home-bundle-editorial.css?v=408-UI-4.3'))==1)
    check(rel+' body marker',s.body and 'ui43-home-bundle' in (s.body.get('class') or []) and s.body.get('data-ui4-home-bundle')=='408-UI-4.3')
    hero=s.select_one('.ui43-hero.ui4-editorial-hero')
    check(rel+' editorial hero',hero is not None)
    check(rel+' copy zone',hero and hero.select_one('.ui43-hero-copy') is not None)
    check(rel+' media zone',hero and hero.select_one('.ui43-hero-media') is not None)
    check(rel+' working form zone',hero and hero.select_one('#form #leadForm') is not None)
    check(rel+' one h1',len(s.find_all('h1'))==1)
    check(rel+' relationship band',s.select_one('.ui43-relationship-band') is not None)
    check(rel+' sms relation',s.select_one('.ui43-relationship-band a[href^="sms:"]') is not None)
    check(rel+' tel relation',s.select_one('.ui43-relationship-band a[href^="tel:"]') is not None)
    check(rel+' editorial columns',len(s.select('.ui43-support-columns > .ui4-editorial-column'))==3)
    check(rel+' trust strip',len(s.select('.ui43-trust-strip .ui4-trust-strip__item'))==4)
    check(rel+' form exact',form_hash(rel)==BASE['form_sha256'][rel],f"{form_hash(rel)} != {BASE['form_sha256'][rel]}")

home=BeautifulSoup((ROOT/'home/index.html').read_text(),'html.parser')
for sel in ['[data-home-campaign-badge]','[data-home-campaign-eyebrow]','[data-home-campaign-title]','[data-home-campaign-lead]','[data-home-campaign-copy]','[data-home-campaign-cta]','[data-home-campaign-reassurance]']:
    check('home campaign node '+sel,home.select_one(sel) is not None)
check('home anchor contract',home.find(id='coverage-review') is not None)
check('home engagement retained',home.select_one('[data-home-engagement]') is not None)
check('home payoff retained',home.select_one('[data-home-payoff]') is not None)
check('home progressive retained',home.select_one('[data-home-progressive-lead], form[data-home-progressive-lead]') is not None)

bundle=BeautifulSoup((ROOT/'auto-bundle/index.html').read_text(),'html.parser')
for sel in ['[data-campaign-entry-eyebrow]','[data-campaign-entry-title]','[data-campaign-entry-lead]','[data-campaign-entry-form-kicker]','[data-campaign-entry-form-title]','[data-campaign-entry-submit]']:
    check('bundle campaign node '+sel,bundle.select_one(sel) is not None)
check('bundle renter destination',bundle.select_one('form[data-cf-renter-destination]') is not None)
check('bundle housing branch',bundle.select_one('form[data-cf-branch-field="housing_context"]') is not None)

for rel,old in BASE['non_target_public_html_sha256'].items():
    p=ROOT/rel; check('non-target exists '+rel,p.exists())
    if p.exists(): check('non-target exact '+rel,sha(p)==old)
for rel,old in BASE['protected_sha256'].items():
    p=ROOT/rel; check('protected exists '+rel,p.exists())
    if p.exists(): check('protected exact '+rel,sha(p)==old)

css=(ROOT/'shared/home-bundle-editorial.css').read_text()
for token in ['ui43-hero','grid-template-areas:"copy media action"','ui43-relationship-band','ui43-support-columns','ui43-trust-strip','var(--ui4-gold-500)','var(--ui3-red)']:
    check('css token '+token,token in css)
for bp in ['@media(max-width:1120px)','@media(max-width:860px)','@media(max-width:620px)']:
    check('responsive '+bp,bp in css)
check('reduced motion','prefers-reduced-motion' in css)

text=(ROOT/'home/index.html').read_text().lower()+(ROOT/'auto-bundle/index.html').read_text().lower()
for bad in ['we shop top-rated carriers','serving our community since 1974','guaranteed savings','guaranteed discount','instant approval']:
    check('no unsupported '+bad,bad not in text)
road=(ROOT/'408-UI-4-ROADMAP.md').read_text()
check('roadmap 4.3 complete','408-UI-4.3 — Home + Bundle Editorial Convergence — COMPLETE' in road)
check('roadmap next 4.4','408-UI-4.4 — Buyer Editorial Convergence' in road)

passed=sum(c['passed'] for c in checks)
out={'sprint':'408-UI-4.3','suite':'home_bundle_editorial_source','total':len(checks),'passed':passed,'failed':len(checks)-passed,'checks':checks}
(ROOT/'UI4_3_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-4.3 QA: {passed}/{len(checks)} passed')
sys.exit(0 if passed==len(checks) else 1)
