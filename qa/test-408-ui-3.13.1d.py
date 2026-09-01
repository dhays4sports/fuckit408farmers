#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'UI3_13_1D_INPUT_BASELINE.json').read_text())
checks=[]
def ck(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)

def sha(p): return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
# Foundation / scope
css=(ROOT/'shared/relationship-human.css').read_text()
for token in ['post-lead-human-portrait','coveragefit-human-portrait','relationship-completion','relationship-humanized','local-business-human','prefers-reduced-motion','forced-colors']:
    ck('relationship css '+token,token in css)
for rel in ['home/index.html','auto-bundle/index.html','buyer/index.html','healthcare/index.html','teachers/index.html','tech/index.html','engineers/index.html','home/thank-you.html','auto-bundle/thank-you.html','buyer/thank-you.html','healthcare/thank-you.html','teachers/thank-you.html','tech/thank-you.html','engineers/thank-you.html','contact/index.html','local/index.html','local/detail/index.html','local/join/index.html','local/join/thank-you.html']:
    s=(ROOT/rel).read_text(); ck(rel+' relationship css','relationship-human.css?v=408-UI-3.13.1D' in s); ck(rel+' relationship meta','408farmers-human-trust-relationship' in s)
# Forms exact
for name,path in {'home':'home/index.html','auto_bundle':'auto-bundle/index.html','buyer':'buyer/index.html','healthcare':'healthcare/index.html','teachers':'teachers/index.html','tech':'tech/index.html','engineers':'engineers/index.html','local_join':'local/join/index.html'}.items():
    soup=BeautifulSoup((ROOT/path).read_text(),'html.parser'); form=soup.find('form',id='leadForm') if name!='local_join' else soup.find('form')
    h=hashlib.sha256(str(form).encode()).hexdigest(); ck(name+' form exact',h==BASE['form_hashes'][name],h)
# Post lead relationship + behavioral anchors
post=(ROOT/'shared/post-lead-engagement.js').read_text()
for token in ['Thanks — I have your request.','Thanks — your request is on its way.','You can keep going from here.','You’re not submitting another request.','A few quick questions will help me focus the review.','I have what I need for now.','post-lead-human-portrait']:
    ck('post lead human '+token,token in post)
for token in ['post_lead_engagement_viewed','post_lead_question_answered','post_lead_payoff_viewed','post_lead_invitation_requested','post_lead_continuation_deferred','typeof settings.onContinue !== \'function\'']:
    ck('post lead behavior '+token,token in post)
ck('post lead no fetch','fetch(' not in post); ck('post lead no timers','setTimeout(' not in post and 'setInterval(' not in post)
# Invitation
inv=(ROOT/'shared/coveragefit-invitation.js').read_text()
for token in ['Your request is complete.','Your information is already submitted','I have what I need to start reviewing it','Have me follow up','I have your request.','coveragefit-human-portrait','Would you like to get a head start on Dylan’s review?']:
    ck('invitation '+token,token in inv)
for token in ['coveragefit_invitation_viewed','coveragefit_invitation_accepted','coveragefit_invitation_deferred','coveragefit_invitation_back_selected']:
    ck('invitation behavior '+token,token in inv)
ck('invitation no fetch','fetch(' not in inv); ck('invitation no timers','setTimeout(' not in inv and 'setInterval(' not in inv)
# Receipts
receipt_expect={
'home/thank-you.html':'I have your home review request.', 'auto-bundle/thank-you.html':'I have your home + auto review request.',
'healthcare/thank-you.html':'I have your healthcare professional review request.','teachers/thank-you.html':'I have your educator professional review request.',
'tech/thank-you.html':'I have your technology professional review request.','engineers/thank-you.html':'I have your engineering professional review request.'}
for rel,text in receipt_expect.items():
    s=(ROOT/rel).read_text(); soup=BeautifulSoup(s,'html.parser')
    ck(rel+' receipt class','relationship-completion' in (soup.body.get('class') or [])); ck(rel+' human title',text in soup.get_text(' ',strip=True)); ck(rel+' dylan signature',bool(soup.select_one('.relationship-receipt-signature'))); ck(rel+' no response guarantee','no response time is guaranteed' in soup.get_text(' ',strip=True)); ck(rel+' four next steps',len(soup.select('.next-steps > p'))==4); ck(rel+' local independence','no insurance purchase or quote is required' in soup.get_text(' ',strip=True).lower())
# Buyer receipt legacy + human
soup=BeautifulSoup((ROOT/'buyer/thank-you.html').read_text(),'html.parser'); txt=soup.get_text(' ',strip=True)
ck('buyer legacy h1',soup.find('h1') and soup.find('h1').get_text(strip=True)=='Your buyer review is started.')
ck('buyer human title','Thanks — I have your request.' in txt); ck('buyer receipt signature',bool(soup.select_one('.relationship-receipt-signature'))); ck('buyer no response guarantee','no response time is guaranteed' in txt)
# Contact destinations / human cue
soup=BeautifulSoup((ROOT/'contact/index.html').read_text(),'html.parser'); txt=soup.get_text(' ',strip=True)
ck('contact humanized','relationship-humanized' in soup.body.get('class',[])); ck('contact direct human cue','You’ll reach me directly.' in txt); ck('contact no call center','No call-center handoff.' in txt)
for href in ['tel:+14083276377','mailto:dylan.vtam@farmersagency.com?subject=Coverage%20review&body=Hi%20Dylan%2C%20I%20would%20like%20an%20insurance%20review.']:
    ck('contact destination '+href,any(a.get('href')==href for a in soup.find_all('a')))
# Local warmth + strict separation
for rel in ['local/index.html','local/join/index.html','local/join/thank-you.html','local/detail/index.html']:
    soup=BeautifulSoup((ROOT/rel).read_text(),'html.parser'); txt=soup.get_text(' ',strip=True).lower(); ck(rel+' humanized','relationship-humanized' in soup.body.get('class',[])); ck(rel+' separation','no insurance purchase or quote' in txt or 'separate from insurance' in txt)
loc=(ROOT/'local/index.html').read_text(); ck('local human tagline','Useful places. Local perks. South Bay businesses.' in loc); ck('local merchant dylan','Merchant applications are reviewed by Dylan.' in loc)
join=(ROOT/'local/join/index.html').read_text(); ck('join human hero','Tell me about your business and the perk you’d like to offer.' in join); ck('join reviewer','I review the merchant applications for the Local pilot.' in join)
thanks=(ROOT/'local/join/thank-you.html').read_text(); ck('join thanks human','I have your Local pilot application.' in thanks); ck('join no guarantee','guarantee acceptance' in thanks)
# Protected exact hashes, including Life and INFRA critical files
for rel,h in BASE['protected_files'].items(): ck('protected exact '+rel,sha(rel)==h,sha(rel))
# Internal links / assets
broken=[]; total_links=0
for p in ROOT.rglob('*.html'):
    parts=p.relative_to(ROOT).parts
    if any(part.startswith('_') for part in parts) or (len(parts)>=2 and parts[0]=='qa' and parts[1]=='fixtures'): continue
    soup=BeautifulSoup(p.read_text(errors='ignore'),'html.parser')
    for tag,attr in [('a','href'),('link','href'),('script','src'),('img','src'),('source','srcset')]:
        for el in soup.find_all(tag):
            v=el.get(attr)
            if not v: continue
            vals=[v]
            if attr=='srcset': vals=[x.strip().split()[0] for x in v.split(',') if x.strip()]
            for val in vals:
                if val.startswith(('http:','https:','mailto:','tel:','sms:','data:','#','javascript:')): continue
                u=val.split('?',1)[0].split('#',1)[0]
                if not u: continue
                total_links+=1
                target=(ROOT/u.lstrip('/')) if u.startswith('/') else (p.parent/u).resolve()
                # pretty routes may resolve to folder index
                ok=target.exists() or (target/'index.html').exists() or (target.suffix=='' and target.with_suffix('.html').exists())
                if not ok: broken.append((str(p.relative_to(ROOT)),val))
ck('internal links/assets',not broken,str(broken[:8]))
out={'sprint':'408-UI-3.13.1D','suite':'relationship_completion_humanization_source','total':len(checks),'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'internal_links_checked':total_links,'broken':broken,'checks':checks}
(ROOT/'UI3_13_1D_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-3.13.1D source QA: {out['passed']}/{out['total']} passed; links {total_links}, broken {len(broken)}")
sys.exit(0 if out['failed']==0 else 1)
