#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'UI3_13_1B_INPUT_BASELINE.json').read_text())
checks=[]
def check(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

css=ROOT/'shared/professional-programs-human.css'
check('humanization stylesheet exists',css.exists())
ct=css.read_text() if css.exists() else ''
for token in ['professional-hero-photo','professional-benefits','professional-hero-cta','professional-signature','--pro-gold','forced-colors:active','prefers-reduced-motion:reduce']:
    check('css '+token,token in ct)

expected={
 'healthcare':('Healthcare professionals','Work in Healthcare?','professional-healthcare-480.webp'),
 'teachers':('Educators','Are You a Teacher?','professional-teachers-480.webp'),
 'tech':('Technology professionals','Work in Tech?','professional-tech-480.webp'),
 'engineers':('Engineering professionals','Are You an Engineer?','professional-engineers-480.webp'),
}
for slug,(kicker,title,img) in expected.items():
    p=ROOT/slug/'index.html'; soup=BeautifulSoup(p.read_text(),'html.parser')
    check(slug+' marker',soup.body.get('data-human-trust-professional')=='408-UI-3.13.1B')
    check(slug+' css link',soup.find('link',href='/shared/professional-programs-human.css?v=408-UI-3.13.1B') is not None)
    check(slug+' one h1',len(soup.find_all('h1'))==1)
    check(slug+' profession kicker',soup.select_one('[data-campaign-entry-eyebrow]').get_text(' ',strip=True)==kicker)
    check(slug+' profession title',soup.select_one('[data-campaign-entry-title]').get_text(' ',strip=True)==title)
    photo=soup.select_one('.professional-hero-photo img')
    check(slug+' professional photo',photo is not None and photo.get('src','').endswith(img))
    check(slug+' photo has alt',bool(photo and photo.get('alt','').strip()))
    check(slug+' hero benefit list',len(soup.select('.professional-benefits li'))==3)
    check(slug+' hero CTA',soup.select_one('.professional-hero-cta[href="#form"]') is not None)
    check(slug+' eligibility qualifier','eligibility, underwriting, and policy terms' in soup.select_one('.professional-eligibility-note').get_text(' ',strip=True).lower())
    sig=soup.select_one('.professional-signature')
    check(slug+' Dylan signature',sig is not None and 'Dylan Haysbert' in sig.get_text(' ',strip=True))
    check(slug+' signature text action',sig is not None and sig.find('a',href=re.compile(r'^sms:\+14083276377')) is not None)
    check(slug+' signature call action',sig is not None and sig.find('a',href='tel:+14083276377') is not None)
    check(slug+' no duplicate meet Dylan',soup.select_one('.quote-card .meet-dylan') is None)
    check(slug+' form campaign hooks',all(soup.select_one(sel) is not None for sel in ['[data-campaign-entry-form-kicker]','[data-campaign-entry-form-title]','[data-campaign-entry-submit]']))
    check(slug+' campaign title hook',soup.select_one('[data-campaign-entry-title]') is not None)
    check(slug+' 4 program switch links',len(soup.select('.professional-program-switcher a'))==4)
    check(slug+' active program',len(soup.select('.professional-program-switcher a[aria-current="page"]'))==1)
    # Preserve form behavior contract even though visible submit copy is humanized.
    f=soup.select_one('#leadForm'); base=BASE['form_contracts'][slug]
    check(slug+' form action preserved',f.get('action')==base['action'])
    check(slug+' form method preserved',f.get('method')==base['method'])
    current=[]
    for e in f.select('input,select,textarea,button'):
        current.append({'tag':e.name,'name':e.get('name'),'type':e.get('type'),'required':e.has_attr('required'),'value':e.get('value'),'options':[o.get('value',o.get_text(strip=True)) for o in e.select('option')] if e.name=='select' else None})
    check(slug+' form control contract preserved',current==base['controls'])
    check(slug+' one primary form submit',len(f.select('button.primary-button[type="submit"]'))==1)
    check(slug+' content no software-context headline','review context' not in soup.select_one('.content-section h2').get_text(' ',strip=True).lower())

for name,h in BASE['protected_files'].items():
    check(name+' protected hash',sha(ROOT/name)==h)

# New crops exist and are small production WebPs.
for slug in expected:
    img=ROOT/'shared/images'/f'professional-{slug}-480.webp'
    check(slug+' crop exists',img.exists())
    if img.exists(): check(slug+' crop budget',img.stat().st_size<100000,str(img.stat().st_size))

passed=sum(x['passed'] for x in checks)
out={'sprint':'408-UI-3.13.1B','suite':'professional_programs_humanization_source','total':len(checks),'passed':passed,'failed':len(checks)-passed,'checks':checks}
(ROOT/'UI3_13_1B_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-3.13.1B source QA: {passed}/{len(checks)} passed')
sys.exit(0 if passed==len(checks) else 1)
