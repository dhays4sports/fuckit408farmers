#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
BASE=json.load(open(ROOT/'PROFESSIONAL_PROGRAMS_EDITORIAL_INPUT_BASELINE.json'))
PROGRAMS=['healthcare','teachers','tech','engineers']
checks=[]
def check(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
for p in PROGRAMS:
    fp=ROOT/p/'index.html'; src=fp.read_text(); s=BeautifulSoup(src,'html.parser')
    check(p+' body marker','ui45-professional-editorial' in (s.body.get('class') or []) and s.body.get('data-ui4-professional')=='408-UI-4.5')
    check(p+' css',s.find('link',href=lambda x:x and 'professional-programs-editorial.css' in x) is not None)
    check(p+' js',s.find('script',src=lambda x:x and 'professional-programs-editorial.js' in x) is not None)
    check(p+' switcher four',len(s.select('.professional-program-switcher a'))==4)
    check(p+' switcher icons',len(s.select('.professional-program-switcher .ui45-program-icon'))==4)
    hero=s.select_one('.ui45-professional-hero.ui4-editorial-hero')
    check(p+' hero',hero is not None)
    check(p+' copy zone',hero and hero.select_one('.ui45-professional-copy') is not None)
    check(p+' media zone',hero and hero.select_one('.ui45-professional-media img') is not None)
    check(p+' action zone',hero and hero.select_one('.ui45-professional-action #leadForm') is not None)
    for sel in ['[data-campaign-entry-eyebrow]','[data-campaign-entry-title]','[data-campaign-entry-lead]','[data-campaign-entry-form-kicker]','[data-campaign-entry-form-title]','[data-campaign-entry-submit]']:
        check(p+' campaign node '+sel,s.select_one(sel) is not None)
    m=re.search(r'(<form\b[^>]*\bid="leadForm"[^>]*>.*?</form>)',src,re.S)
    h=hashlib.sha256(m.group(1).encode()).hexdigest() if m else ''
    check(p+' form exact',h==BASE['forms_sha256'][p],f'{h} != {BASE["forms_sha256"][p]}')
    check(p+' relationship',s.select_one('.ui45-professional-relationship.ui4-relationship-band') is not None)
    check(p+' relationship sms',s.select_one('.ui45-professional-relationship a[href^="sms:"]') is not None)
    check(p+' relationship tel',s.select_one('.ui45-professional-relationship a[href^="tel:"]') is not None)
    check(p+' three support cols',len(s.select('.ui45-professional-support > .ui4-editorial-column'))==3)
    check(p+' three steps',len(s.select('.ui45-professional-support .ui4-step'))==3)
    check(p+' trust four',len(s.select('.ui45-professional-trust .ui4-trust-strip__item'))==4)
    check(p+' one h1',len(s.find_all('h1'))==1)
    text=s.get_text(' ',strip=True).lower()
    check(p+' qualifier','subject to eligibility' in text and 'underwriting' in text)
    for bad in ['guaranteed discount','automatically qualifies','guaranteed savings','we shop top-rated carriers','serving our community since 1974']:
        check(p+' no '+bad,bad not in text)
for rel,old in BASE['non_target_public_html_sha256'].items():
    pp=ROOT/rel; check('non-target exists '+rel,pp.exists())
    if pp.exists(): check('non-target exact '+rel,sha(pp)==old)
for rel,old in BASE['protected_sha256'].items():
    pp=ROOT/rel; check('protected exists '+rel,pp.exists())
    if pp.exists(): check('protected exact '+rel,sha(pp)==old)
css=(ROOT/'shared/professional-programs-editorial.css').read_text()
for token in ['ui45-professional-hero','grid-template-areas:"copy media action"','ui45-professional-media','ui45-professional-panel','ui45-professional-relationship','ui45-professional-support','ui45-title-accent','var(--ui3-red','var(--ui4-gold']:
    check('css '+token,token in css)
for bp in ['@media(max-width:1180px)','@media(max-width:860px)','@media(max-width:560px)','prefers-reduced-motion','forced-colors:active']:
    check('responsive '+bp,bp in css)
for p in PROGRAMS:
    check('context image '+p,(ROOT/'shared/images'/f'ui45-professional-{p}.webp').exists())
road=(ROOT/'408-UI-4-ROADMAP.md').read_text()
check('roadmap 4.5 complete','408-UI-4.5 — Professional Programs Campaign Convergence — COMPLETE' in road)
check('roadmap next 4.6','408-UI-4.6 — Local Community Convergence' in road)
passed=sum(x['passed'] for x in checks)
out={'sprint':'408-UI-4.5','suite':'professional_programs_editorial_source','total':len(checks),'passed':passed,'failed':len(checks)-passed,'checks':checks}
(ROOT/'UI4_5_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-4.5 QA: {passed}/{len(checks)} passed')
sys.exit(0 if passed==len(checks) else 1)
