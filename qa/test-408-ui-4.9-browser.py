#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json,sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,cond,detail=None):
    checks.append({'name':name,'passed':bool(cond),'detail':detail})
    if not cond: print('FAIL',name,detail or '')
def inline_page(rel):
    pp=ROOT/rel; soup=BeautifulSoup(pp.read_text(errors='ignore'),'html.parser'); css=[]
    for link in list(soup.find_all('link')):
        if 'stylesheet' not in (link.get('rel') or []): continue
        href=(link.get('href') or '').split('?')[0]
        fp=(ROOT/href.lstrip('/')) if href.startswith('/') else (pp.parent/href).resolve()
        if fp.exists(): css.append(fp.read_text(errors='ignore'))
    for script in list(soup.find_all('script',src=True)): script.decompose()
    for img in soup.find_all('img'): img['src']=''; img.attrs.pop('srcset',None)
    for source in soup.find_all('source'): source.decompose()
    for c in css:
        st=soup.new_tag('style'); st.string=c; soup.head.append(st)
    return str(soup)
def no_overflow(page,label):
    d=page.evaluate('()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
    check(label+' reflow',max(d['sw'],d['bw'])<=d['w']+2,str(d))

routes=['index.html','home/index.html','auto-bundle/index.html','buyer/index.html','healthcare/index.html','teachers/index.html','tech/index.html','engineers/index.html','local/index.html','local/detail/index.html','local/join/index.html','home/thank-you.html','buyer/thank-you.html','contact/index.html','neighbor/index.html','score/index.html','404.html','privacy.html','terms.html']
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    cache={r:inline_page(r) for r in routes}
    # 320 CSS px is the project proxy for 400% desktop zoom/reflow and narrow-phone use.
    page=b.new_page(viewport={'width':320,'height':820})
    for rel in routes:
        page.set_content(cache[rel],wait_until='load')
        check(rel+' marker',page.locator('body.ui49-accessibility-performance').count()==1)
        no_overflow(page,rel+' 320/400%')
    page.close()

    # Keyboard skip navigation and visible focus indicator.
    for rel in ['index.html','home/index.html','buyer/index.html','healthcare/index.html','local/index.html','contact/index.html','score/index.html']:
        page=b.new_page(viewport={'width':390,'height':844}); page.set_content(cache[rel])
        page.keyboard.press('Tab')
        active=page.evaluate('()=>({tag:document.activeElement.tagName,id:document.activeElement.id,cls:document.activeElement.className,href:document.activeElement.getAttribute("href")})')
        check(rel+' first tab skip',active.get('cls') and 'skip-link' in str(active.get('cls')),str(active))
        focus=page.locator('.skip-link').evaluate('e=>({ow:getComputedStyle(e).outlineWidth,os:getComputedStyle(e).outlineStyle,transform:getComputedStyle(e).transform})')
        check(rel+' focus visible',float(focus['ow'].replace('px','') or 0)>=2 and focus['os']!='none',str(focus))
        page.keyboard.press('Enter')
        target=page.evaluate('()=>({id:document.activeElement.id,hash:location.hash})')
        expected=BeautifulSoup((ROOT/rel).read_text(errors='ignore'),'html.parser').select_one('a.skip-link').get('href')
        check(rel+' skip destination',target['hash']==expected,str(target))
        page.close()

    # Reduced motion applies even though UI-4 pages do not carry the old ui3-page class.
    page=b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce'); page.set_content(cache['index.html'])
    td=page.locator('a[href]').first.evaluate('e=>getComputedStyle(e).transitionDuration')
    check('reduced motion active','0.01ms' in td or td in ('0s','0.001s','1e-05s'),td)
    page.close()

    # Forced-colors keeps a concrete focus outline and primary control boundary.
    page=b.new_page(viewport={'width':390,'height':844},forced_colors='active'); page.set_content(cache['healthcare/index.html'])
    page.keyboard.press('Tab')
    fs=page.locator('.skip-link').evaluate('e=>({ow:getComputedStyle(e).outlineWidth,os:getComputedStyle(e).outlineStyle})')
    check('forced colors focus outline',float(fs['ow'].replace('px','') or 0)>=3 and fs['os']!='none',str(fs))
    btn=page.locator('.ui45-professional-hero-cta').first
    border=btn.evaluate('e=>getComputedStyle(e).borderTopWidth') if btn.count() else '0px'
    check('forced colors primary boundary',float(border.replace('px','') or 0)>=1,border)
    page.close()
    b.close()

out={'sprint':'408-UI-4.9','suite':'accessibility_reflow_browser','total':len(checks),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'routes':routes,'checks':checks}
(ROOT/'UI4_9_BROWSER_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-4.9 Browser QA: {out['passed']}/{out['total']} passed")
sys.exit(1 if out['failed'] else 0)
