#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import json,sys,re
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,ok,detail=''):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: print('FAIL',name,detail)
def lum(hexv):
    h=hexv.lstrip('#'); rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    def f(c): return c/12.92 if c<=.03928 else ((c+.055)/1.055)**2.4
    r,g,b=map(f,rgb); return .2126*r+.7152*g+.0722*b
def contrast(a,b):
    x,y=lum(a),lum(b); hi,lo=max(x,y),min(x,y); return (hi+.05)/(lo+.05)
for slug in ['healthcare','teachers','tech','engineers']:
    soup=BeautifulSoup((ROOT/slug/'index.html').read_text(),'html.parser')
    check(slug+' main landmark',soup.find('main',id='main-content') is not None)
    check(slug+' single h1',len(soup.find_all('h1'))==1)
    check(slug+' skip link',soup.select_one('a.skip-link[href="#main-content"]') is not None)
    photo=soup.select_one('.professional-hero-photo img')
    check(slug+' profession image alt',bool(photo and photo.get('alt','').strip()))
    dylan=soup.select_one('.professional-signature img')
    check(slug+' Dylan image alt',dylan is not None and dylan.get('alt')=='Dylan Haysbert')
    check(slug+' live hero title',soup.select_one('[data-campaign-entry-title]') is not None)
    check(slug+' live eligibility qualifier',soup.select_one('.professional-eligibility-note') is not None)
    check(slug+' CTA accessible text','Check My Eligibility' in soup.select_one('.professional-hero-cta').get_text(' ',strip=True))
    check(slug+' form status live',soup.select_one('#formStatus[aria-live="polite"][role="status"]') is not None)
    check(slug+' no positive tabindex',not any((e.get('tabindex') or '').isdigit() and int(e.get('tabindex'))>0 for e in soup.find_all(tabindex=True)))
    form=soup.select_one('#leadForm')
    controls=form.select('input:not([type="hidden"]),select,textarea')
    # existing form controls are wrapped by labels or consent label.
    unlabeled=[]
    for e in controls:
        if e.find_parent('label') is None and not (e.get('id') and soup.find('label',attrs={'for':e.get('id')})):
            unlabeled.append(e.get('name') or e.name)
    check(slug+' controls labeled',not unlabeled,str(unlabeled))
    check(slug+' required consent remains',form.select_one('input[name="consent"][required]') is not None)
css=(ROOT/'shared/professional-programs-human.css').read_text()
check('reduced motion support','prefers-reduced-motion:reduce' in css)
check('forced colors support','forced-colors:active' in css)
check('gold text contrast >=4.5',contrast('#805500','#ffffff')>=4.5,str(contrast('#805500','#ffffff')))
check('primary red contrast >=4.5',contrast('#d71920','#ffffff')>=4.5,str(contrast('#d71920','#ffffff')))
check('bright gold not used as body text',not re.search(r'(?m)^\s*color:\s*var\(--pro-gold-bright\)',css))
passed=sum(x['passed'] for x in checks)
out={'sprint':'408-UI-3.13.1B','suite':'professional_programs_accessibility_delta','total':len(checks),'passed':passed,'failed':len(checks)-passed,'checks':checks}
(ROOT/'UI3_13_1B_ACCESSIBILITY_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'408-UI-3.13.1B accessibility QA: {passed}/{len(checks)} passed')
sys.exit(0 if passed==len(checks) else 1)
