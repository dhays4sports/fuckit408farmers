#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'UI4_7_INPUT_BASELINE.json').read_text())
checks=[]
def check(name,cond,detail=None):
    checks.append({'name':name,'passed':bool(cond),'detail':detail})
    if not cond: print('FAIL',name,detail or '')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p): return p.read_text(errors='ignore')

check('sprint doc exists',(ROOT/'SPRINT-408-UI-4.7.md').exists())
check('contract exists',(ROOT/'UI4_7_RELATIONSHIP_COMPLETION_CONTRACT.json').exists())
check('editorial completion css exists',(ROOT/'shared/editorial-completion.css').exists())
check('editorial workflow css exists',(ROOT/'shared/editorial-workflow.css').exists())
css=read(ROOT/'shared/editorial-completion.css')
for token in [
 '408-UI-4.7 — Relationship + Completion Editorial Convergence',
 '.post-lead-engagement','.coveragefit-invitation',
 'ui47-completion-editorial','ui47-contact-editorial','ui47-handoff-editorial',
 'ui47-score-editorial','ui47-utility-editorial','ui47-legal-editorial',
 'prefers-reduced-motion','forced-colors:active'
]:
    check('css token '+token,token in css)

dynamic=['home/index.html','auto-bundle/index.html','buyer/index.html','healthcare/index.html','teachers/index.html','tech/index.html','engineers/index.html']
receipts=['home/thank-you.html','auto-bundle/thank-you.html','buyer/thank-you.html','healthcare/thank-you.html','teachers/thank-you.html','tech/thank-you.html','engineers/thank-you.html']
utility={
 'contact/index.html':'ui47-contact-editorial',
 'neighbor/index.html':'ui47-handoff-editorial',
 'score/index.html':'ui47-score-editorial',
 '404.html':'ui47-utility-editorial',
 'privacy.html':'ui47-legal-editorial',
 'terms.html':'ui47-legal-editorial',
 'local/join/thank-you.html':'ui47-local-completion',
}
for rel in dynamic:
    soup=BeautifulSoup(read(ROOT/rel),'html.parser')
    check(rel+' workflow stylesheet',soup.find('link',href='/shared/editorial-workflow.css?v=408-UI-4.7') is not None)
    check(rel+' legacy relationship layer removed',soup.find('link',href='/shared/relationship-human.css?v=408-UI-3.13.1D') is None)
    check(rel+' body marker','ui47-relationship-editorial' in (soup.body.get('class') or []))
    check(rel+' sprint data',soup.body.get('data-ui4-relationship-completion')=='408-UI-4.7')
for rel in receipts:
    soup=BeautifulSoup(read(ROOT/rel),'html.parser')
    check(rel+' stylesheet',soup.find('link',href='/shared/editorial-completion.css?v=408-UI-4.7') is not None)
    check(rel+' body marker','ui47-completion-editorial' in (soup.body.get('class') or []))
    check(rel+' direct Dylan sms',soup.find('a',href=re.compile(r'^sms:\+14083276377')) is not None)
    check(rel+' direct Dylan call',soup.find('a',href='tel:+14083276377') is not None)
for rel,cls in utility.items():
    soup=BeautifulSoup(read(ROOT/rel),'html.parser')
    check(rel+' stylesheet',soup.find('link',href='/shared/editorial-completion.css?v=408-UI-4.7') is not None)
    check(rel+' marker',cls in (soup.body.get('class') or []))

# Receipt truthfulness and Local separation.
for rel in [r for r in receipts if r!='buyer/thank-you.html']:
    t=BeautifulSoup(read(ROOT/rel),'html.parser').get_text(' ',strip=True)
    check(rel+' request received truth',('I have' in t) or ('received' in t.lower()))
    check(rel+' no response guarantee preserved','no response time is guaranteed' in t)
    check(rel+' underwriting caveat','underwriting' in t.lower())
    check(rel+' Local independence','no insurance purchase or quote is required' in t.lower())
buyer=read(ROOT/'buyer/thank-you.html')
check('buyer receipt canonical H1 preserved','Your buyer review is started.' in buyer)
check('buyer no response guarantee preserved','no response time is guaranteed' in buyer)
check('buyer Local independence','no insurance purchase or quote is required' in buyer.lower())

# Neighbor and Score semantic contracts.
neighbor=read(ROOT/'neighbor/index.html')
check('neighbor CoverageFit destination','https://coveragefit.com/home/?ref=neighbor' in neighbor)
check('neighbor no PII disclosure','contains no homeowner name, address, phone number, email, or coverage details' in neighbor)
score=read(ROOT/'score/index.html')
check('score Coverage Review identity','What’s your Home <span>Protection Score?</span>' in score)
check('score no generic quote','Start with a personalized Coverage Review, not a generic quote request.' in score)

# Forms remain exact to input baseline.
for rel,want in BASE['forms'].items():
    soup=BeautifulSoup(read(ROOT/rel),'html.parser')
    form=soup.find('form')
    got=hashlib.sha256(str(form).encode()).hexdigest()
    check(rel+' form exact',got==want)

# Protected files remain exact.
for rel,want in BASE['protected_files'].items():
    check(rel+' exact',sha(ROOT/rel)==want)
# Life exact.
for rel,want in BASE['life_files'].items():
    check(rel+' life exact',sha(ROOT/rel)==want)

# Roadmap advanced.
road=read(ROOT/'408-UI-4-ROADMAP.md')
check('roadmap 4.7 complete','408-UI-4.7 — Relationship + Completion Editorial Convergence — COMPLETE' in road)
check('roadmap next 4.8','408-UI-4.8 — Mobile + Responsive Editorial Pass' in road)

out={'sprint':'408-UI-4.7','suite':'source_behavior_contract','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks}
(ROOT/'UI4_7_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-4.7 QA: {out['passed']}/{out['total']} passed")
sys.exit(1 if out['failed'] else 0)
