#!/usr/bin/env python3
from pathlib import Path
from collections import Counter
import hashlib,json,re,sys
from urllib.parse import urlsplit
from bs4 import BeautifulSoup
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
BASE=Path('/mnt/data/ui37_baseline')
checks=[]
def check(name,cond):
    checks.append({'name':name,'passed':bool(cond)})
    if not cond: print('FAIL',name)
def read(p): return p.read_text(errors='ignore')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def form_block(text):
    m=re.search(r'<form\b[\s\S]*?</form>',text,re.I)
    return m.group(0) if m else ''

new_text=read(ROOT/'life/index.html');base_text=read(BASE/'life/index.html')
new=BeautifulSoup(new_text,'html.parser');base=BeautifulSoup(base_text,'html.parser')
check('UI37 stylesheet exists',(ROOT/'shared/life-campaign-platform.css').exists())
check('UI37 campaign image exists',(ROOT/'shared/assets/life-family-campaign.jpg').exists())
check('UI37 sprint doc exists',(ROOT/'SPRINT-408-UI-3.7.md').exists())
check('UI37 contract exists',(ROOT/'UI3_7_LIFE_CAMPAIGN_PLATFORM_CONTRACT.json').exists())
check('UI37 roadmap exists',(ROOT/'408-UI-ROADMAP.md').exists())
check('UI37 meta hook',new.find('meta',attrs={'name':'408farmers-ui-life','content':'408-UI-3.7'}) is not None)
check('UI37 CSS hook',len(new.find_all('link',href='/shared/life-campaign-platform.css?v=408-UI-3.7'))==1)
check('UI31 foundation retained',len(new.find_all('link',href='/shared/ui-3-foundation.css?v=408-UI-3.1'))==1 and len(new.find_all('script',src='/shared/ui-3-foundation.js?v=408-UI-3.1'))==1)
check('body UI37 hook',new.body and new.body.get('data-ui-life')=='408-UI-3.7')
check('life runtime build retained',new.body and new.body.get('data-life-build')=='408-LIFE-1.7')
check('campaign matching hooks retained',all(new.select_one(x) is not None for x in ['[data-life-hero-title]','[data-life-hero-lead]','[data-life-hero-support]','[data-life-start]']))
visual=new.select_one('.life-campaign-visual')
check('campaign visual exists',visual is not None)
img=visual.find('img') if visual else None
check('campaign visual uses family asset',img is not None and img.get('src')=='../shared/assets/life-family-campaign.jpg')
check('campaign continuity language exists',visual is not None and 'While life is normal.' in visual.get_text(' ',strip=True) and 'Before you need it.' in visual.get_text(' ',strip=True))
check('campaign credential exists',visual is not None and 'Farmers Life Insurance' in visual.get_text(' ',strip=True) and '408-FARMERS' in visual.get_text(' ',strip=True))

# The secure application form is byte-identical.
check('life secure form byte-identical',form_block(new_text)==form_block(base_text))
nf=new.find('form',attrs={'data-life-intake-form':True});bf=base.find('form',attrs={'data-life-intake-form':True})
check('life secure form exists',nf is not None and bf is not None)
if nf and bf:
    nn=Counter(x.get('name') for x in nf.find_all(['input','select','textarea']) if x.get('name'))
    bn=Counter(x.get('name') for x in bf.find_all(['input','select','textarea']) if x.get('name'))
    check('life field inventory unchanged',nn==bn)
    check('life required inventory unchanged',Counter((x.name,x.get('name')) for x in nf.find_all(['input','select','textarea']) if x.has_attr('required'))==Counter((x.name,x.get('name')) for x in bf.find_all(['input','select','textarea']) if x.has_attr('required')))
check('life script inventory unchanged',Counter(s.get('src') for s in new.find_all('script',src=True))==Counter(s.get('src') for s in base.find_all('script',src=True)))
check('thank-you remains byte-identical',sha(ROOT/'life/thank-you.html')==sha(BASE/'life/thank-you.html'))

# Campaign runtime: only visible VARIANTS copy may change. Attribution/alias/function logic is byte-identical.
new_campaign=read(ROOT/'shared/life-campaign.js');base_campaign=read(BASE/'shared/life-campaign.js')
check('campaign runtime pre-variant logic unchanged',new_campaign.split('  var VARIANTS = {',1)[0]==base_campaign.split('  var VARIANTS = {',1)[0])
check('campaign attribution and routing logic unchanged',new_campaign.split('  var ALIASES = {',1)[1]==base_campaign.split('  var ALIASES = {',1)[1])
for token in ["before_anything_changes","'20_minutes'","this_is_the_time","financial_picture","code: 'A'","code: 'B'","code: 'C'","code: 'D'","ATTR_KEYS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','campaign_id','campaign_variant','creative']"]:
    check('campaign contract token '+token,token in new_campaign)
check('Creative A campaign copy aligned','Life changes. Health changes. Eligibility can too.' in new_campaign and 'before you need it.' in new_campaign)
check('Creative B 20:00 aligned',"titleHtml: '<span>20:00</span>'" in new_campaign and 'Potential same-day decision for eligible applicants.' in new_campaign)
check('Creative C campaign copy aligned','Not after a diagnosis. Not after a health change. While life is normal.' in new_campaign)

# Protected application / Worker / queue runtimes remain byte-identical.
protected=['_worker.js','shared/life-conversion.js','shared/life-intake.js','shared/life-secure-submit.js','shared/life-ops.js','shared/life-ops.css','life-ops/index.html','LIFE-PRODUCTION-CERTIFICATION.md','LIFE-SECURE-SUBMISSION-DEPLOYMENT.md','shared/ui-3-foundation.css','shared/ui-3-foundation.js']
for rel in protected:
    a=ROOT/rel;b=BASE/rel
    check(rel+':present',a.exists() and b.exists())
    if a.exists() and b.exists(): check(rel+':byte-identical',sha(a)==sha(b))

# No non-Life public HTML was changed.
public_base=[p for p in BASE.rglob('*.html') if not p.relative_to(BASE).as_posix().startswith(('qa/fixtures/','life-ops/'))]
for b in public_base:
    rel=b.relative_to(BASE)
    if rel.as_posix()=='life/index.html': continue
    a=ROOT/rel
    check(f'{rel}:still exists',a.exists())
    if a.exists(): check(f'{rel}:byte-identical baseline',sha(a)==sha(b))

css=read(ROOT/'shared/life-campaign-platform.css')
for token in ['--life-campaign-black','--life-campaign-red','var(--life-campaign-red)','var(--ui3-navy-950)','body.life-page.ui3-page .life-hero','body.life-page.ui3-page .life-campaign-visual','body.life-page.ui3-page .life-start-section','body.life-page.ui3-page .life-intake-shell','body.life-page.ui3-page .life-why-now']:
    check('life campaign CSS token '+token,token in css)
check('campaign canvas remains dark','background:var(--life-campaign-black)!important' in css)
check('application working surface remains white','background:#fff!important' in css and '.life-intake-shell' in css)
check('red urgency punctuation exists','h1 span::after' in css and 'background:var(--life-campaign-red)' in css)
check('phone breakpoint','@media(max-width:700px)' in css)
check('tablet breakpoint','@media(max-width:980px)' in css)
check('short landscape support','max-height:520px' in css)
check('reduced motion support','prefers-reduced-motion:reduce' in css)
check('forced colors support','forced-colors:active' in css)
check('mobile 16px fields','font-size:16px!important' in css)

with Image.open(ROOT/'shared/assets/life-family-campaign.jpg') as im:
    check('campaign image has usable dimensions',im.width>=500 and im.height>=800)
    check('campaign image portrait ratio',im.height>im.width)

# Internal links across public HTML.
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

result={'sprint':'408-UI-3.7','suite':'source_contract','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'internal_links_checked':total,'broken_links':broken[:20],'checks':checks}
(ROOT/'UI3_7_QA.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"408-UI-3.7 QA: {result['passed']}/{result['total']} passed; internal links {total}, broken {len(broken)}")
sys.exit(1 if result['failed'] else 0)
