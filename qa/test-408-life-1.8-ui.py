#!/usr/bin/env python3
import json, pathlib, re

ROOT=pathlib.Path(__file__).resolve().parent.parent
read=lambda name:(ROOT/name).read_text()
checks=[]
def check(name,value):
    assert value,name
    checks.append(name)

life=read('life/index.html')
css=read('shared/life.css')
intake=read('shared/life-intake.js')
submit=read('shared/life-secure-submit.js')
ops_html=read('life-ops/index.html')
ops_css=read('shared/life-ops.css')
ops_js=read('shared/life-ops.js')

check('existing LIFE visual foundation remains loaded',all(token in life for token in ['shared/styles.css','shared/life.css','life-hero','life-intake-shell','life-primary-cta']))
check('changed LIFE assets use a release cache key',life.count('v=408-LIFE-1.8')>=3 and ops_html.count('v=408-LIFE-1.8')>=2)
check('primary carrier action is short and obvious','Create my secure application' in life)
check('secondary action is concise and subordinate','class="life-finish-later"' in life and '>Finish with Dylan later<' in life and css.index('.life-finish-later')>css.index('.life-primary-cta'))
check('finish-later appears before sensitive fields',life.index('data-life-finish-later')<life.index('name="date_of_birth"')<life.index('name="ssn_last4"'))
check('DOB uses native date input and last four uses bounded numeric password',re.search(r'type="date"[^>]+name="date_of_birth"',life) and re.search(r'type="password"[^>]+name="ssn_last4"[^>]+pattern="\[0-9\]\{4\}"',life))
check('sensitive inputs do not autocomplete',re.search(r'name="ssn_last4"[^>]+autocomplete="off"',life) is not None)
check('form status is an announced live region','data-life-submit-status role="status" aria-live="polite"' in life)
check('validation errors are announced',len(re.findall(r'class="life-step-error"[^>]+role="alert"',life))>=6)
check('one-time reveal panel is hidden initially','data-life-sensitive-panel hidden' in ops_html)
check('one-time reveal panel receives managed focus','data-life-sensitive-panel hidden aria-live="polite" tabindex="-1"' in ops_html and "panel.focus" in ops_js)
check('ordinary operations identity section has no sensitive output hooks','data-life-detail="date_of_birth"' not in ops_html and 'data-life-detail="ssn_last4"' not in ops_html)
check('responsive rules cover 320 to 430 mobile widths','@media(max-width:760px)' in css and '@media(max-width:640px)' in ops_css)
check('reduced motion remains supported','prefers-reduced-motion:reduce' in css and 'prefers-reduced-motion:reduce' in ops_css)
check('forced colors remain supported','forced-colors:active' in css and 'forced-colors:active' in ops_css)
check('new controls have visible keyboard focus', '.life-finish-later:focus-visible' in css and '.life-ops-reveal:focus-visible' in ops_css)
check('event-table mode keeps sensitive inputs out of autocomplete',"dataset.lifeEventMode = 'table'" in intake and "setAttribute('autocomplete', 'off')" in intake)
check('BFCache and pagehide clear application fields',"window.addEventListener('pagehide'" in intake and 'event.persisted' in intake and 'clearApplicationFields()' in intake)
check('submit module clears serialized sensitive references',"Object.keys(payload.sensitive)" in submit and 'payload.acknowledgement = null' in submit)
check('no framework dependency introduced',not re.search(r'react|vue|angular|svelte|bootstrap\.js|jquery',life+intake+submit+ops_js,re.I))
check('completion copy distinguishes carrier and follow-later modes','No date of birth or Social Security digits were sent' in intake and "mode === 'finish_with_dylan_later'" in intake)

report={'sprint':'408-LIFE-1.8-ui-static','passed':len(checks),'failed':0,'checks':checks,'browser_canary_required':True}
(ROOT/'LIFE1_8_UI_QA.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
