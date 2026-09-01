#!/usr/bin/env python3
from pathlib import Path
import base64,json,os,re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
CHROMIUM=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
checks=[]
def check(name,value):
    assert value,name
    checks.append(name)

def clean_html(rel):
    s=(ROOT/rel).read_text()
    s=re.sub(r'<link[^>]+rel="stylesheet"[^>]*>','',s,flags=re.I)
    s=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',s,flags=re.I)
    return s

def add_styles(page,*files):
    for f in files: page.add_style_tag(content=(ROOT/f).read_text())
def add_script(page,rel): page.add_script_tag(content=(ROOT/rel).read_text())

def install_fetch_mock(page):
    page.evaluate("""
      window.__lifeCalls=[];
      window.fetch=async function(url,options){
        var u=String(url), body=options&&options.body?String(options.body):'';
        window.__lifeCalls.push({url:u,body:body});
        if(u.indexOf('/api/life/application-init')>=0) return new Response(JSON.stringify({ok:true}),{status:202,headers:{'Content-Type':'application/json'}});
        if(u.indexOf('/api/life/conversion')>=0) return new Response(JSON.stringify({ok:true}),{status:202,headers:{'Content-Type':'application/json'}});
        return new Response(JSON.stringify({ok:false}),{status:404,headers:{'Content-Type':'application/json'}});
      };
    """)

def mount_page(page):
    page.set_content(clean_html('life/index.html'),wait_until='load')
    add_styles(page,'shared/styles.css','shared/life.css','shared/accessibility.css','shared/ui-3-foundation.css','shared/life-campaign-platform.css')
    # Make campaign artwork fully loadable in the isolated QA document.
    # UI-3.13 wraps the campaign image in <picture>; remove isolated srcset sources
    # so the deterministic data-URI fallback below owns the QA image load.
    page.locator('.life-campaign-photo source').evaluate_all('(els)=>els.forEach(e=>e.remove())')
    raw=(ROOT/'shared/assets/life-family-campaign.jpg').read_bytes()
    data='data:image/jpeg;base64,'+base64.b64encode(raw).decode()
    page.locator('.life-campaign-photo img').evaluate('(img,src)=>img.src=src',data)
    install_fetch_mock(page)
    for js in ['shared/accessibility.js','shared/life-campaign.js','shared/life-conversion.js','shared/life-intake.js','shared/life-secure-submit.js','shared/ui-3-foundation.js']:
        add_script(page,js)
    page.wait_for_function("document.body.dataset.lifeCampaignMatchingReady==='true' && document.body.dataset.lifeConversionReady==='true' && document.body.classList.contains('ui3-page')")

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce');page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    mount_page(page)
    check('desktop no runtime errors',not errors)
    check('UI37 body hook',page.locator('body').get_attribute('data-ui-life')=='408-UI-3.7')
    check('universal header enhanced',page.locator('.ui3-site-header').count()==1 and page.locator('.ui3-primary-nav').count()==1)
    check('universal footer enhanced',page.locator('.ui3-site-footer').count()==1)
    title=' '.join(page.locator('[data-life-hero-title]').inner_text().split()).lower()
    check('default campaign headline message matched','before anything changes' in title)
    check('default campaign lead message matched','Life changes. Health changes. Eligibility can too.' in page.locator('[data-life-hero-lead]').inner_text())
    check('default campaign support message matched','before you need it.' in page.locator('[data-life-hero-support]').inner_text())
    check('campaign family image loads',page.locator('.life-campaign-photo img').evaluate('(img)=>img.complete && img.naturalWidth>0'))
    check('campaign continuity copy visible','while life is normal.' in page.locator('.life-campaign-photo-copy').inner_text().lower())
    check('hero canvas visually dark',page.locator('body').evaluate("e=>getComputedStyle(e).backgroundColor==='rgb(2, 3, 6)'"))
    check('hero headline renders white',page.locator('[data-life-hero-title]').evaluate("e=>getComputedStyle(e).color==='rgb(255, 255, 255)'"))
    check('application section visually dark',page.locator('.life-start-section').evaluate("e=>getComputedStyle(e).backgroundImage!=='none'"))
    check('application working surface is white',page.locator('.life-intake-shell').evaluate("e=>getComputedStyle(e).backgroundColor==='rgb(255, 255, 255)'"))
    check('why-now section dark',page.locator('.life-why-now').evaluate("e=>getComputedStyle(e).backgroundColor==='rgb(2, 3, 6)'"))
    check('desktop no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'))
    ctx.close()

    ctx=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    mount_page(page)
    check('mobile no runtime errors',not errors)
    check('mobile no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'))
    check('mobile campaign visual visible',page.locator('.life-campaign-visual').is_visible())
    check('mobile menu button >=44px',page.locator('.ui3-menu-toggle').evaluate("e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44}"))
    page.locator('[data-life-start]').click()
    page.check('input[name="protection_priority"][value="family_income"]')
    check('step 1 continue enables',page.locator('[data-life-step="1"] [data-life-next]').is_enabled())
    page.locator('[data-life-step="1"] [data-life-next]').click()
    check('step 2 visible',page.locator('[data-life-step="2"]').is_visible())
    check('application input font size >=16',float(page.locator('.life-field input').first.evaluate("e=>parseFloat(getComputedStyle(e).fontSize)"))>=16)
    # Conversion measurement remains fail-open and dedicated-path only.
    calls=page.evaluate('window.__lifeCalls')
    check('Life measurement calls stay on dedicated API',all('/api/life/' in c['url'] for c in calls if c['url']!='null'))
    ctx.close();browser.close()

report={'sprint':'408-UI-3.7','suite':'browser_rendering','passed':len(checks),'failed':0,'checks':checks}
(ROOT/'UI3_7_BROWSER_QA.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
