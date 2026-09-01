#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import hashlib, json, re, sys
ROOT=Path(__file__).resolve().parents[1]
BASE=Path('/mnt/data/ui311_baseline')
PUBLIC=sorted([p for p in ROOT.rglob('*.html') if '/qa/' not in str(p) and 'life-ops' not in str(p)])
checks=[]
def ok(name,passed,detail=''):
    checks.append({'name':name,'passed':bool(passed),'detail':detail})

def text_name(t):
    txt=' '.join(t.stripped_strings)
    if txt: return txt
    for a in ('aria-label','title'):
        if t.get(a): return t.get(a)
    im=t.find('img')
    return (im.get('alt') if im else '') or ''

def rel(p): return str(p.relative_to(ROOT))

ok('public_surface_count',len(PUBLIC)==27,str(len(PUBLIC)))
for p in PUBLIC:
    s=BeautifulSoup(p.read_text(errors='ignore'),'html.parser'); r=rel(p)
    ids={}
    for t in s.find_all(attrs={'id':True}): ids[t['id']]=ids.get(t['id'],0)+1
    ok(r+':lang',bool(s.html and s.html.get('lang')=='en'))
    vp=s.find('meta',attrs={'name':'viewport'}); content=(vp.get('content','') if vp else '').lower()
    ok(r+':viewport',bool(vp and 'width=device-width' in content and 'viewport-fit=cover' in content and 'user-scalable=no' not in content and 'maximum-scale=1' not in content),content)
    ok(r+':title',bool(s.title and s.title.get_text(strip=True)))
    mains=s.find_all('main'); ok(r+':single_main',len(mains)==1,str(len(mains)))
    h1=s.find_all('h1'); ok(r+':single_h1',len(h1)==1,str(len(h1)))
    main=mains[0] if len(mains)==1 else None
    ok(r+':main_focus_target',bool(main and main.get('id') and main.get('tabindex')=='-1'))
    skip=s.select_one('a.skip-link'); ok(r+':skip_link',bool(skip and skip.get('href','').startswith('#') and skip.get('href')[1:] in ids))
    ok(r+':unique_ids',all(v==1 for v in ids.values()),','.join(k for k,v in ids.items() if v>1))
    source=p.read_text()
    ok(r+':a11y_build_marker','408farmers-accessibility-build' in source and '408-UI-3.11' in source)
    ok(r+':a11y_cert_css','accessibility-certification.css?v=408-UI-3.11' in source)
    ok(r+':a11y_cert_js','accessibility-certification.js?v=408-UI-3.11' in source)
    if 'mobile-interaction.css' in source:
        ok(r+':cert_layer_order',source.find('accessibility-certification.css') > source.find('mobile-interaction.css'))
    # Heading sequence, visible static tree.
    prev=0; jumps=[]
    for h in s.find_all(re.compile('^h[1-6]$')):
        if h.has_attr('hidden') or h.find_parent(attrs={'hidden':True}): continue
        level=int(h.name[1])
        if prev and level>prev+1: jumps.append(f'h{prev}->h{level}')
        prev=level
    ok(r+':heading_sequence',not jumps,','.join(jumps))
    # Images.
    missing=[t.get('src','') for t in s.find_all('img') if not t.has_attr('alt')]
    ok(r+':image_alts',not missing,','.join(missing[:5]))
    # Interactive names.
    unnamed=[]
    for t in s.find_all(['a','button','summary']):
        if t.name=='a' and not t.get('href'): continue
        if not text_name(t).strip(): unnamed.append(t.name+' '+str(t.get('class','')))
    ok(r+':interactive_names',not unnamed,';'.join(unnamed[:5]))
    # Form labels.
    unlabeled=[]
    for t in s.find_all(['input','select','textarea']):
        typ=(t.get('type') or '').lower()
        if typ in ('hidden','submit','button','reset'): continue
        label=t.get('aria-label') or t.get('aria-labelledby')
        if not label and t.get('id'): label=s.find('label',attrs={'for':t['id']})
        if not label and t.find_parent('label'): label=True
        if not label: unlabeled.append(t.get('name') or t.get('id') or t.name)
    ok(r+':control_labels',not unlabeled,','.join(unlabeled[:8]))
    # ARIA IDREF validity + tabindex.
    badrefs=[]; positive=[]
    for t in s.find_all(True):
        for attr in ('aria-labelledby','aria-describedby','aria-controls'):
            for ref in (t.get(attr,'') or '').split():
                if ref not in ids: badrefs.append(attr+':'+ref)
        ti=t.get('tabindex')
        if ti and re.fullmatch(r'-?\d+',ti) and int(ti)>0: positive.append(t.name+'#'+t.get('id',''))
    ok(r+':aria_idrefs',not badrefs,','.join(badrefs[:8]))
    ok(r+':no_positive_tabindex',not positive,','.join(positive[:8]))
    # Dialog naming where present.
    baddialog=[]
    for d in s.find_all('dialog'):
        if not (d.get('aria-label') or d.get('aria-labelledby')): baddialog.append(d.get('id') or 'dialog')
    ok(r+':dialog_names',not baddialog,','.join(baddialog))

# Contract-preservation checks against exact 3.10 input.
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
protected=[p.relative_to(ROOT) for p in ROOT.rglob('*.js') if '/qa/' not in str(p) and p.name!='accessibility-certification.js']
protected += [Path('_worker.js'),Path('local/data/catalog.json')]
seen=set()
for rp in protected:
    rp=Path(rp)
    if str(rp) in seen: continue
    seen.add(str(rp))
    a=ROOT/rp; b=BASE/rp
    ok('freeze:'+str(rp),a.exists() and b.exists() and sha(a)==sha(b),'' if not (a.exists() and b.exists()) else ('same' if sha(a)==sha(b) else 'changed'))

# Form contracts: actions/methods and control attributes remain identical.
def forms_contract(path):
    s=BeautifulSoup(path.read_text(errors='ignore'),'html.parser'); result=[]
    for f in s.find_all('form'):
        controls=[]
        for c in f.find_all(['input','select','textarea','button']):
            controls.append({k:c.get(k) for k in ('name','type','value','required','action','formaction','autocomplete','pattern','minlength','maxlength') if c.has_attr(k)})
        result.append({'action':f.get('action'),'method':(f.get('method') or 'get').lower(),'id':f.get('id'),'controls':controls})
    return result
for p in PUBLIC:
    bp=BASE/p.relative_to(ROOT)
    ok('form_freeze:'+rel(p),bp.exists() and forms_contract(p)==forms_contract(bp))

# Contrast certification for UI-3.11 explicit/high-risk token pairs.
def rgb(h): h=h.lstrip('#'); return [int(h[i:i+2],16)/255 for i in (0,2,4)]
def lum(h):
    vals=[]
    for c in rgb(h): vals.append(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4)
    return .2126*vals[0]+.7152*vals[1]+.0722*vals[2]
def ratio(a,b):
    x,y=lum(a),lum(b); return (max(x,y)+.05)/(min(x,y)+.05)
def composite(fg,bg,alpha):
    f=[int(fg[i:i+2],16) for i in (1,3,5)]; b=[int(bg[i:i+2],16) for i in (1,3,5)]
    c=[round(alpha*x+(1-alpha)*y) for x,y in zip(f,b)]
    return '#'+''.join(f'{x:02x}' for x in c)
pairs=[
 ('ink_on_white','#14243a','#ffffff',4.5),('muted_on_white','#637287','#ffffff',4.5),('red_on_white','#d71920','#ffffff',4.5),
 ('white_on_red','#ffffff','#d71920',4.5),('control_border_on_white','#8291a3','#ffffff',3.0),('focus_on_white','#005fcc','#ffffff',3.0),
 ('white_on_navy','#ffffff','#031a3d',4.5),('life_accent_on_black','#ff6670','#020306',4.5),('life_accent_on_navy','#ff6670','#07162c',4.5),
 ('footer_50pct_white_on_navy',composite('#ffffff','#031a3d',.5),'#031a3d',4.5)
]
for name,fg,bg,minr in pairs:
    rr=ratio(fg,bg); ok('contrast:'+name,rr>=minr,f'{rr:.2f}:1 >= {minr}:1')

css=(ROOT/'shared/accessibility-certification.css').read_text()
js=(ROOT/'shared/accessibility-certification.js').read_text()
ok('reduced_motion','@media (prefers-reduced-motion:reduce)' in css)
ok('forced_colors','@media (forced-colors:active)' in css)
ok('focus_appearance','outline:3px solid var(--ui311-focus)' in css and '0 0 0 5px var(--ui311-focus)' in css)
ok('zoom_reflow','text-size-adjust:100%' in css and '@media (max-width:360px)' in css)
ok('native_invalid_semantics',"document.addEventListener('invalid'" in js and "setAttribute('aria-invalid','true')" in js)
ok('status_atomicity',"setAttribute('aria-atomic','true')" in js)
ok('menu_escape_focus_return','ui3-menu-toggle[aria-expanded="true"]' in js and 'toggle.focus' in js)

passed=sum(1 for c in checks if c['passed']); total=len(checks)
report={'sprint':'408-UI-3.11','status':'PASS' if passed==total else 'FAIL','passed':passed,'total':total,'checks':checks}
(ROOT/'UI3_11_ACCESSIBILITY_QA.json').write_text(json.dumps(report,indent=2))
print(f'408-UI-3.11: {passed}/{total} — {report["status"]}')
if passed!=total:
    for c in checks:
        if not c['passed']: print('FAIL',c['name'],c['detail'])
    sys.exit(1)
