#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import hashlib,json,sys,re
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'UI4_4_BASELINE.json').read_text())
checks=[]
def check(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def form_hash():
    t=(ROOT/'buyer/index.html').read_text()
    m=re.search(r'(<form\b[^>]*\bid="leadForm"[^>]*>.*?</form>)',t,re.S)
    return hashlib.sha256(m.group(1).encode()).hexdigest() if m else ''

p=ROOT/'buyer/index.html'; s=BeautifulSoup(p.read_text(),'html.parser')
check('buyer css exists',(ROOT/'shared/buyer-editorial.css').exists())
check('buyer contract exists',(ROOT/'BUYER_EDITORIAL_CONVERGENCE_CONTRACT.json').exists())
check('buyer sprint doc exists',(ROOT/'SPRINT-408-UI-4.4.md').exists())
check('buyer meta hook',s.find('meta',attrs={'name':'408farmers-editorial-buyer','content':'408-UI-4.4'}) is not None)
check('buyer css hook',s.find('link',href='/shared/buyer-editorial.css?v=408-UI-4.4') is not None)
check('body marker',s.body and 'ui44-buyer-editorial' in (s.body.get('class') or []) and s.body.get('data-ui4-buyer')=='408-UI-4.4')
hero=s.select_one('.ui44-buyer-hero.ui4-editorial-hero')
check('editorial hero',hero is not None)
check('copy zone',hero and hero.select_one('.ui44-buyer-copy') is not None)
check('media zone',hero and hero.select_one('.ui44-buyer-media') is not None)
check('working form action',hero and hero.select_one('.ui44-buyer-action #leadForm') is not None)
check('buyer review anchor',s.find(id='buyer-review') is not None)
check('referral acknowledgement',s.select_one('[data-buyer-referral]') is not None and s.select_one('[data-buyer-referral-name]') is not None)
for sel in ['[data-campaign-entry-kicker]','[data-campaign-entry-title]','[data-campaign-entry-lead]','[data-campaign-entry-body]','[data-campaign-entry-start-online]']:
    check('campaign node '+sel,s.select_one(sel) is not None)
check('text Dylan hero',s.select_one('[data-buyer-text-link][data-buyer-text-location="hero"]') is not None)
check('start online hero',s.select_one('[data-buyer-start-online]') is not None)
check('two progress items',len(s.select('[data-buyer-progress]'))==2)
check('two buyer steps',len(s.select('#leadForm [data-buyer-step]'))==2)
check('form exact',form_hash()==BASE['form_sha256'],f'{form_hash()} != {BASE["form_sha256"]}')
check('relationship band',s.select_one('.ui44-buyer-relationship.ui4-relationship-band') is not None)
check('relationship sms',s.select_one('.ui44-buyer-relationship a[href^="sms:"]') is not None)
check('relationship tel',s.select_one('.ui44-buyer-relationship a[href^="tel:"]') is not None)
check('support three columns',len(s.select('.ui44-buyer-support > .ui4-editorial-column'))==3)
check('promise steps 3',len(s.select('.ui44-buyer-support .buyer-promise'))==3)
check('trust strip 4',len(s.select('.ui44-buyer-trust .ui4-trust-strip__item'))==4)
check('one h1',len(s.find_all('h1'))==1)
text=s.get_text(' ',strip=True).lower()
for bad in ['guaranteed turnaround','same-day closing','guaranteed savings','we shop top-rated carriers','serving our community since 1974']:
    check('no unsupported '+bad,bad not in text)
# explicit conservative language
check('no instant quote retained','not an instant quote' in text)
check('underwriting qualifier','subject to underwriting' in text)
# protected files exact to post-edit baseline (none were changed by this sprint after capture)
for rel,old in BASE['protected_sha256'].items():
    pp=ROOT/rel; check('protected exists '+rel,pp.exists())
    if pp.exists(): check('protected exact '+rel,sha(pp)==old)
# every other public html exact
for rel,old in BASE['non_target_public_html_sha256'].items():
    pp=ROOT/rel; check('non-target exists '+rel,pp.exists())
    if pp.exists(): check('non-target exact '+rel,sha(pp)==old)
css=(ROOT/'shared/buyer-editorial.css').read_text()
for token in ['ui44-buyer-hero','grid-template-areas:"copy media action"','ui44-buyer-relationship','ui44-buyer-support','ui44-buyer-trust','var(--ui4-gold-600)','var(--ui3-red)']:
    check('css token '+token,token in css)
for bp in ['@media(max-width:1120px)','@media(max-width:860px)','@media(max-width:620px)','max-height:540px']:
    check('responsive '+bp,bp in css)
check('reduced motion','prefers-reduced-motion' in css)
check('forced colors','forced-colors:active' in css)
road=(ROOT/'408-UI-4-ROADMAP.md').read_text()
check('roadmap 4.4 complete','408-UI-4.4 — Buyer Editorial Convergence — COMPLETE' in road)
check('roadmap next 4.5','408-UI-4.5 — Professional Programs Campaign Convergence' in road)
passed=sum(c['passed'] for c in checks)
out={'sprint':'408-UI-4.4','suite':'buyer_editorial_source','total':len(checks),'passed':passed,'failed':len(checks)-passed,'checks':checks}
(ROOT/'UI4_4_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-4.4 QA: {passed}/{len(checks)} passed')
sys.exit(0 if passed==len(checks) else 1)
