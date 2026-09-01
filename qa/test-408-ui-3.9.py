#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import hashlib,json,re,sys
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]
BASE=Path('/mnt/data/ui39_baseline')
checks=[]
def check(name,cond):
    checks.append({'name':name,'passed':bool(cond)})
    if not cond: print('FAIL',name)
def read(p): return p.read_text(errors='ignore')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

check('sprint doc exists',(ROOT/'SPRINT-408-UI-3.9.md').exists())
check('contract exists',(ROOT/'UI3_9_UTILITY_COMPLETION_CONTRACT.json').exists())
check('404 exists',(ROOT/'404.html').exists())
css=read(ROOT/'shared/ui-3-foundation.css')
check('UI39 utility layer in foundation','408-UI-3.9 — Utility + Completion Surfaces' in css)
for selector in ['.thanks>.thanks-card','.buyer-thanks-card','.life-thanks-card','.local-join-thanks','.contact-choice-shell','.referral-bridge-shell','.ui3-error-card','.local-directory-empty','.home-recovery']:
    check('utility selector '+selector,selector in css)
check('life campaign dark receipt','body.life-thanks-page.ui3-page' in css and 'background:#02060d!important' in css)
check('contact compact shell','body.contact-choice-page.ui3-page .contact-choice-shell' in css)
check('legal document shell','thanks-card[style*="text-align:left"]' in css)
check('phone utility breakpoint','@media(max-width:520px)' in css)
check('forced colors utility support','forced-colors:active' in css)
check('reduced motion bridge support','prefers-reduced-motion:reduce' in css)

# Generic fallback receipts retain their original destinations / Local attribution while repairing malformed next-step markup.
receipts=['home/thank-you.html','auto-bundle/thank-you.html','healthcare/thank-you.html','teachers/thank-you.html','tech/thank-you.html','engineers/thank-you.html']
for rel in receipts:
    soup=BeautifulSoup(read(ROOT/rel),'html.parser')
    check(rel+' main receipt',soup.find('main',class_='thanks') is not None)
    check(rel+' request language','received' in soup.get_text(' ',strip=True).lower())
    check(rel+' text Dylan',soup.find('a',href=re.compile(r'^sms:\+14083276377')) is not None)
    check(rel+' call Dylan',soup.find('a',href='tel:+14083276377') is not None)
    local=soup.find('section',class_='post-submit-local')
    check(rel+' Local remains after receipt',local is not None)
    ns=soup.find(class_='next-steps')
    check(rel+' next steps exists',ns is not None)
    if ns:
        check(rel+' valid next steps heading',ns.find('h2') is not None and ns.find('h2').get_text(' ',strip=True)=='What happens next')
        check(rel+' four next-step statements',len(ns.find_all('p'))==4)

# Buyer receipt preserves referral/closing fallback contract and Local completion surface.
buyer=read(ROOT/'buyer/thank-you.html')
check('buyer request wording preserved','Your buyer review is started.' in buyer)
check('buyer Local attribution preserved','surface=buyer_completion' in buyer)
check('buyer no guarantee wording preserved','no response time is guaranteed' in buyer)

# Life receipt HTML and protected secure submission runtime stay byte-identical; convergence is CSS-only.
check('life thank-you byte-identical',sha(ROOT/'life/thank-you.html')==sha(BASE/'life/thank-you.html'))
for rel in ['_worker.js','shared/coveragefit-launch.js','shared/referral-bridge.js','shared/local-attribution.js','shared/local-join.js','shared/local-merchant.js','shared/life-secure-submit.js','shared/life-intake.js','shared/buyer-flow.js']:
    check(rel+' byte-identical',sha(ROOT/rel)==sha(BASE/rel))

# Contact remains direct and destination-identical.
contact=BeautifulSoup(read(ROOT/'contact/index.html'),'html.parser')
check('contact SMS destination preserved',contact.find('a',attrs={'data-contact-sms':True}) is not None and contact.find('a',attrs={'data-contact-sms':True})['href'].startswith('sms:+14083276377'))
check('contact phone preserved',contact.find('a',href='tel:+14083276377') is not None)
check('contact email preserved',contact.find('a',attrs={'data-contact-email':True}) is not None and contact.find('a',attrs={'data-contact-email':True})['href'].startswith('mailto:dylan.vtam@farmersagency.com'))
check('contact agency identity preserved','Virginia Tam Insurance Agency, Inc.' in contact.get_text(' ',strip=True))
check('contact license preserved','4528400' in contact.get_text(' ',strip=True))

# Legal text remains byte-identical; presentation comes from the shared foundation.
check('privacy byte-identical',sha(ROOT/'privacy.html')==sha(BASE/'privacy.html'))
check('terms byte-identical',sha(ROOT/'terms.html')==sha(BASE/'terms.html'))

# Neighbor bridge behavior/destination stays unchanged.
neighbor=read(ROOT/'neighbor/index.html')
check('neighbor bridge destination preserved','https://coveragefit.com/home/?ref=neighbor' in neighbor)
check('neighbor no PII statement preserved','contains no homeowner name, address, phone number, email, or coverage details' in neighbor)
check('neighbor runtime preserved',sha(ROOT/'shared/referral-bridge.js')==sha(BASE/'shared/referral-bridge.js'))

# Static 404 is presentation-only and contains useful exits.
err=BeautifulSoup(read(ROOT/'404.html'),'html.parser')
check('404 noindex',err.find('meta',attrs={'name':'robots','content':'noindex,nofollow'}) is not None)
check('404 UI39 meta',err.find('meta',attrs={'name':'408farmers-ui-utility','content':'408-UI-3.9'}) is not None)
for href in ['/','/home/','/contact/']:
    check('404 exit '+href,err.find('a',href=href) is not None)

# Main product entry HTML remains byte-identical to UI-3.8 input; this sprint does not recompose products.
for rel in ['index.html','home/index.html','auto-bundle/index.html','buyer/index.html','life/index.html','healthcare/index.html','teachers/index.html','tech/index.html','engineers/index.html','local/index.html','local/join/index.html','local/detail/index.html','score/index.html']:
    check(rel+' product entry unchanged',sha(ROOT/rel)==sha(BASE/rel))

# Internal links across public HTML, excluding internal life-ops and fixtures.
public=[p for p in ROOT.rglob('*.html') if not p.relative_to(ROOT).as_posix().startswith(('qa/fixtures/','life-ops/'))]
broken=[];total=0
for p in public:
    soup=BeautifulSoup(read(p),'html.parser')
    for a in soup.find_all('a',href=True):
        href=a['href'].strip()
        if not href or href.startswith(('#','mailto:','tel:','sms:','javascript:','http://','https://')): continue
        path=urlsplit(href).path
        if not path: continue
        total+=1
        target=ROOT/path.lstrip('/') if path.startswith('/') else (p.parent/path).resolve()
        candidates=[target]
        if path.endswith('/') or target.is_dir(): candidates.append(target/'index.html')
        elif target.suffix=='': candidates.extend([Path(str(target)+'.html'),target/'index.html'])
        if not any(c.exists() for c in candidates): broken.append((str(p.relative_to(ROOT)),href))
check('internal links checked >=150',total>=150)
check('internal links broken 0',len(broken)==0)

result={'sprint':'408-UI-3.9','suite':'source_contract','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'internal_links_checked':total,'broken_links':broken[:20],'checks':checks}
(ROOT/'UI3_9_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.9 QA: {result['passed']}/{result['total']} passed; internal links {total}, broken {len(broken)}")
sys.exit(1 if result['failed'] else 0)
