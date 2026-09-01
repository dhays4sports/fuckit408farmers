from pathlib import Path
from urllib.parse import urlparse
import json, re, sys
root=Path(__file__).resolve().parents[1]
checks=[]
def check(name, cond, detail=''):
    checks.append({'name':name,'passed':bool(cond),'detail':detail})

# Required assets and docs
for rel in ['shared/config.js','shared/coveragefit-launch.js','shared/prospect-profile.js','shared/flyer-campaign.js','shared/home-journey-contract.js','shared/home-baseline.js','shared/home-engagement.js','shared/home-engagement.css','shared/home-lead-progressive.js','shared/home-lead-progressive.css','shared/home-confirmation.js','shared/home-confirmation.css','shared/buyer-referral.js','shared/buyer-flow.js','shared/buyer.css','shared/contact-choice.js','shared/contact-choice.css','shared/performance.css','shared/progressive-intake.js','shared/progressive-intake.css','shared/accessibility.css','shared/accessibility.js','shared/assets/buyer-home.jpg','shared/score.js','shared/script.js','score/index.html','home/index.html','buyer/index.html','buyer/thank-you.html','contact/index.html','neighbor/index.html','life/index.html','life/thank-you.html','shared/life.css','shared/life-intake.js','index.html','_redirects','handoff-manifest.json','performance-budgets.json','promise-journey-contract.json','HOME2_1_JOURNEY_CONTRACT.json','HOME2_2_JOURNEY_CONTRACT.json','HOME2_2_ENGAGEMENT_CONTRACT.json','HOME2_3_JOURNEY_CONTRACT.json','HOME2_3_PAYOFF_CONTRACT.json','HOME2_4_JOURNEY_CONTRACT.json','HOME2_4_PROGRESSIVE_LEAD_CONTRACT.json','HOME2_5_JOURNEY_CONTRACT.json','HOME2_5_CONFIRMATION_CONTRACT.json','HOME2_1_CONVERSION_BASELINE.md','SPRINT-408-HOME-2.1.md','SPRINT-408-HOME-2.2.md','SPRINT-408-HOME-2.3.md','SPRINT-408-HOME-2.4.md','SPRINT-408-HOME-2.5.md','qa/test-home-2.1.js','qa/test-home-2.2.js','qa/test-home-2.3.js','qa/test-home-2.4.js','qa/test-home-2.5.js','qa/test-home-2.5-runtime.js','qa/test-home-2.7-deep-route-assets.js','qa/production-handoff-smoke.js','qa/test-408-ho-1c.js','qa/test-np-1.5.js','qa/test-np-1.5-cross-repo.js','qa/test-buyer-flow.js','qa/test-cro-1.2.js','qa/test-cro-1.3.js','qa/test-cro-1.3-browser.mjs','qa/test-cro-1.4.js','qa/test-cro-1.4-browser.mjs','qa/test-cro-1.5.js','qa/test-cro-1.5-browser.mjs','qa/test-cro-1.6.js','qa/test-cro-1.6-browser.mjs','qa/test-cro-1.6.1.js','qa/test-cro-1.6.1-browser.mjs','qa/test-cro-1.6.2.js','qa/test-cro-1.6.2-browser.mjs','qa/test-408-life-1.1.js','SPRINT-408-CONV-1.1.md','SPRINT-408-NP-1.5.md','SPRINT-408-HOME-2.7-QR-ASSET-HOTFIX.md','SPRINT-408-BUY-1.1.md','SPRINT-408-CRO-1.2.md','SPRINT-408-CRO-1.3.md','SPRINT-408-CRO-1.4.md','SPRINT-408-CRO-1.5.md','SPRINT-408-CRO-1.6.md','SPRINT-408-CRO-1.6.1.md','SPRINT-408-CRO-1.6.2.md','professional-intent-contract.json','FLYER-CAMPAIGN-IDENTIFIERS.md','PRODUCTION-HANDOFF-CERTIFICATION.md','PRODUCTION-HANDOFF-CERTIFICATION.json']:
    check(f'exists:{rel}', (root/rel).is_file())

score=(root/'score/index.html').read_text(encoding='utf-8')
check('score loads config before launcher', score.find('../shared/config.js') < score.find('../shared/coveragefit-launch.js'))
check('score loads launcher before score behavior', score.find('../shared/coveragefit-launch.js') < score.find('../shared/score.js'))
check('score has three CTA hooks', score.count('js-start-review') >= 3, str(score.count('js-start-review')))

home_pages={
 'home/index.html':'home_lander_form',
 'tech/index.html':'tech_eligibility_form',
 'engineers/index.html':'engineers_eligibility_form',
 'healthcare/index.html':'healthcare_eligibility_form',
 'teachers/index.html':'teachers_eligibility_form',
 'buyer/index.html':'buyer_lander_form',
}
for rel, entry in home_pages.items():
    text=(root/rel).read_text(encoding='utf-8')
    shared_prefix='/shared/' if rel == 'home/index.html' else '../shared/'
    check(f'{rel}:form launch enabled', 'data-coveragefit-after-submit="true"' in text)
    check(f'{rel}:entry distinct', f'data-cf-entry="{entry}"' in text)
    check(f'{rel}:config before launcher', text.find(shared_prefix+'config.js') < text.find(shared_prefix+'coveragefit-launch.js'))
    check(f'{rel}:profile builder loaded', shared_prefix+'prospect-profile.js' in text)
    check(f'{rel}:launcher before profile builder', text.find(shared_prefix+'coveragefit-launch.js') < text.find(shared_prefix+'prospect-profile.js'))
    check(f'{rel}:profile builder before script', text.find(shared_prefix+'prospect-profile.js') < text.find(shared_prefix+'script.js'))
    expected_build='408-HOME-2.9' if rel == 'home/index.html' else '408-CONV-1.1'
    check(f'{rel}:production build fingerprint', '408farmers-handoff-build' in text and expected_build in text)
    check(f'{rel}:sender build attribute', f'data-sender-build="{expected_build}"' in text)
    check(f'{rel}:direct assessment continuation', 'data-cf-next="/assessment/"' in text)
    check(f'{rel}:handoff contract attribute', 'data-handoff-contract="coveragefit-handoff-v1"' in text)

index=(root/'index.html').read_text(encoding='utf-8')
check('homepage keeps one general CoverageFit launch element', index.count('data-coveragefit-launch="home"') == 1, str(index.count('data-coveragefit-launch="home"')))
check('homepage routes home purchases through buyer concierge', 'href="buyer/"' in index and 'Start my buyer review' in index)
check('homepage keeps auto bundle local', 'href="auto-bundle/"' in index)
check('homepage conversation-only business and landlord intents use reliable contact chooser', all(f'href="contact/?intent={intent}"' in index for intent in ['business','landlord']))
check('homepage routes life to dedicated campaign page', 'href="life/"' in index and 'Explore life insurance' in index)

contact=(root/'contact/index.html').read_text(encoding='utf-8')
check('contact chooser exposes text call and email', all(value in contact for value in ['data-contact-sms','href="tel:+14083276377"','data-contact-email']))
check('contact chooser is not a parallel intake', '<form' not in contact and 'data-coveragefit-after-submit' not in contact)
check('contact chooser route owned by Worker', "'/contact'" in (root/'_worker.js').read_text() and '/contact/index.html' not in (root/'_redirects').read_text())

public_html=[path for path in root.rglob('*.html') if 'qa' not in path.parts]
public_markup='\n'.join(path.read_text(encoding='utf-8') for path in public_html)
check('public SMS links avoid an empty query parameter prefix', '?&body=' not in public_markup and '?&amp;body=' not in public_markup)
check('telephone links never claim to start a text', not any('text' in re.sub(r'<[^>]+>',' ',match.group(1)).lower() for markup in [path.read_text(encoding='utf-8') for path in public_html] for match in re.finditer(r'<a[^>]+href=["\']tel:[^"\']+["\'][^>]*>(.*?)</a>', markup, re.I|re.S)))
for rel in ['home/index.html','auto-bundle/index.html','healthcare/index.html','teachers/index.html','tech/index.html','engineers/index.html']:
    markup=(root/rel).read_text(encoding='utf-8')
    check(f'{rel}:explicit direct contact choices', 'direct-contact-choice' in markup and '>Text Dylan<' in markup and '>Call Dylan<' in markup)

config=(root/'shared/config.js').read_text(encoding='utf-8')
check('canonical CoverageFit URL configured', 'https://coveragefit.com/home/' in config)
check('local fallback configured', '/home#form' in config)


address_js=(root/'shared/address-autocomplete.js').read_text(encoding='utf-8')
home=(root/'home/index.html').read_text(encoding='utf-8')
check('address autocomplete module exists', (root/'shared/address-autocomplete.js').is_file())
check('home address field is eligible', 'data-address-autocomplete="property"' in home)
check('home loads address module before form script', home.find('/shared/address-autocomplete.js') < home.find('/shared/script.js'))
check('address module restricts to US', "includedRegionCodes: ['us']" in address_js)
check('address module requests address predictions', 'fetchAutocompleteSuggestions' in address_js)
check('address module has California bounds', 'CALIFORNIA_BOUNDS' in address_js and 'locationRestriction: CALIFORNIA_BOUNDS' in address_js)
check('address module preserves blank-key manual fallback', "setState('manual')" in address_js)
check('Google Places key is configurable', 'googlePlacesApiKey' in config)
check('Google Places key is configured', bool(re.search(r'googlePlacesApiKey:\s*[\"\']AIza[0-9A-Za-z_-]+[\"\']', config)))
check('address module has three-character threshold', 'MIN_QUERY_LENGTH = 3' in address_js)
check('address module adds accessible helper', 'address-autocomplete-helper' in address_js and 'aria-live' in address_js)
check('address module tracks query readiness', 'addressQueryReady' in address_js)
check('address module handles selected address', 'selectPrediction' in address_js and 'fetchFields' in address_js)
check('address module uses Places API New', 'AutocompleteSuggestion' in address_js and re.search(r"importLibrary\(\s*['\"]places['\"]\s*\)", address_js))
check('address module avoids legacy Autocomplete widget', 'new window.google.maps.places.Autocomplete' not in address_js)
check('address input is never constrained to two characters', 'maxlength="150"' in home and 'maxlength="2"' not in home)
styles=(root/'shared/styles.css').read_text(encoding='utf-8')
check('Places dropdown styled', '.address-suggestion-list' in styles and '.address-suggestion' in styles)
check('Places rows are touch friendly', 'min-height:58px' in styles)
check('short queries suppress predictions', 'query.length < MIN_QUERY_LENGTH' in address_js)
check('1B sprint documentation exists', (root/'SPRINT-408-ADDR-1B.md').is_file())
check('1C sprint documentation exists', (root/'SPRINT-408-ADDR-1C.md').is_file())
check('1D sprint documentation exists', (root/'SPRINT-408-ADDR-1D.md').is_file())
check('1E sprint documentation exists', (root/'SPRINT-408-ADDR-1E.md').is_file())
check('1F sprint documentation exists', (root/'SPRINT-408-ADDR-1F.md').is_file())
check('1G sprint documentation exists', (root/'SPRINT-408-ADDR-1G.md').is_file())
check('address deployment checklist exists', (root/'ADDRESS-AUTOCOMPLETE-QA.md').is_file())
check('address runtime QA exists', (root/'qa/test-address-autocomplete.js').is_file())
for field in ['property_formatted_address','property_street','property_city','property_county','property_state','property_zip','property_country','property_place_id','address_selection_method']:
    check(f'home has structured address field: {field}', f'name=\"{field}\"' in home)
check('address module parses address components', 'parsePlace' in address_js and 'address_components' in address_js)
check('address module stores structured address', 'storeStructuredAddress' in address_js)
check('address module tracks autocomplete method', re.search(r"setHiddenValue\(\s*['\"]address_selection_method['\"]\s*,\s*['\"]autocomplete['\"]\s*\)", address_js))
check('address module preserves manual method', "setHiddenValue('address_selection_method', 'manual')" in address_js)
check('address module clears stale components', 'clearStructuredAddress' in address_js and 'currentValue !== selectedFormattedAddress' in address_js)
check('manual address syncs before submit', 'syncManualAddressForSubmit' in address_js and re.search(r"form\?\.addEventListener\(\s*['\"]submit['\"]", address_js))
check('manual address populates canonical formatted field', re.search(r"setHiddenValue\(\s*['\"]property_formatted_address['\"]\s*,\s*typedAddress\s*\)", address_js))
check('pasted addresses retain manual support', "addEventListener('paste'" in address_js)
check('Google loader has timeout fallback', 'SCRIPT_LOAD_TIMEOUT_MS' in address_js and 'loadTimeout' in address_js)
check('Google loader uses explicit ready callback', 'GOOGLE_READY_CALLBACK' in address_js and 'callback=' in address_js)
check('Google authentication failure preserves fallback', 'gm_authFailure' in address_js and 'settleUnavailable' in address_js)
check('Google key uses strict referrer policy', re.search(r"referrerPolicy\s*=\s*['\"]strict-origin-when-cross-origin['\"]", address_js))
check('address ready integration event exists', "CustomEvent('address:ready'" in address_js)


flyer_campaign=(root/'shared/flyer-campaign.js').read_text(encoding='utf-8')
check('any-ZIP flyer campaign engine exists', 'home_flyer' in flyer_campaign and 'campaign_zip' in flyer_campaign and 'campaign_variant' in flyer_campaign)
check('Home loads flyer campaign before launcher', home.find('/shared/flyer-campaign.js') < home.find('/shared/coveragefit-launch.js'))
for field in ['campaign_id','campaign_variant','campaign_zip']:
    check(f'Home carries flyer field: {field}', f'name="{field}"' in home)

launcher=(root/'shared/coveragefit-launch.js').read_text(encoding='utf-8')
for field in ['campaign','source','entry','assessment','session_id']:
    check(f'launcher sends {field}', f"searchParams.set('{field}'" in launcher)
for field in ['campaign_id','campaign_variant','campaign_zip','utm_source','utm_medium','utm_campaign','utm_term','utm_content','creative','ref','referral']:
    check(f'launcher supports {field}', f"'{field}'" in launcher)

shared_script=(root/'shared/script.js').read_text(encoding='utf-8')
check('form handoff uses form campaign', 'campaign: handoffCampaign' in shared_script)
check('form handoff sends sender build fingerprint', 'sender_build:' in shared_script and '408-CONV-1.1' in shared_script)
check('form handoff sends receiver contract fingerprint', 'handoff_contract:' in shared_script and 'coveragefit-handoff-v1' in shared_script)
check('form handoff sends explicit contact permission', 'contact_consent:' in shared_script and 'CONSENT_VERSION' in shared_script)
check('form handoff sends submission provenance', 'consent_at:' in shared_script and 'submitted_at:' in shared_script)
check('form handoff requests direct assessment', "next: form.dataset.cfNext || '/assessment/'" in shared_script)
check('launcher supports explicit next route', 'next: input.next || null' in launcher and "config.next || '/home/'" in launcher)
check('launcher maps legacy referral to canonical ref', "url.searchParams.set('ref', attribution[key])" in launcher and "!url.searchParams.has('ref')" in launcher)
check('home offers non-renewal reason', 'Non-renewal or cancellation' in home)
check('home offers premium-increase reason', 'Premium increased' in home)
for rel in ['qa/fixtures/coveragefit-v3.20.7/home.html','qa/fixtures/coveragefit-v3.20.7/transition.html','qa/fixtures/coveragefit-v3.20.7/prefill-intake.js','qa/fixtures/coveragefit-v3.20.7/attribution.js','qa/fixtures/coveragefit-v3.20.7/personalization-context.js','qa/fixtures/coveragefit-v3.20.7/transition-route.js']:
    check(f'exists:{rel}', (root/rel).is_file())
for rel in ['qa/fixtures/coveragefit-v3.20.13-conv1.1/prefill-intake.js','qa/fixtures/coveragefit-v3.20.13-conv1.1/personalization-context.js','qa/fixtures/coveragefit-v3.20.13-conv1.1/conversion-handoff.js']:
    check(f'exists:{rel}', (root/rel).is_file())
check('obsolete TX-1.1 fixture removed', not (root/'qa/fixtures/coveragefit-tx1.1').exists())
manifest=json.loads((root/'handoff-manifest.json').read_text(encoding='utf-8'))
check('handoff manifest identifies current build', manifest.get('build') == '408-CONV-1.1', manifest.get('build',''))
check('handoff manifest identifies receiver contract', manifest.get('handoffContract') == 'coveragefit-handoff-v1', manifest.get('handoffContract',''))
check('manifest identifies NP-1.5 referral receiver', manifest.get('referralBridge',{}).get('build') == '408-NP-1.5' and manifest.get('referralBridge',{}).get('receiver') == 'CoverageFit v3.20.18')
check('handoff manifest identifies current CoverageFit receiver', manifest.get('receiver') in ['CoverageFit v3.20.51','CoverageFit v3.20.52','CoverageFit v3.20.53','CoverageFit v3.20.54','CoverageFit v3.20.55','CoverageFit v3.20.56','CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'], manifest.get('receiver',''))
check('handoff manifest retains minimum receiver compatibility', manifest.get('minimumCompatibleReceiver') == 'CoverageFit v3.20.13', manifest.get('minimumCompatibleReceiver',''))
check('handoff manifest preserves CRO-1.2 contact choices after later CRO work', manifest.get('runtime') in ['408-CRO-1.2','408-CRO-1.3','408-CRO-1.4','408-CRO-1.5','408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'] and manifest.get('contactChoices',{}).get('build') == '408-CRO-1.2')
check('handoff manifest preserves CRO-1.3 mobile performance', manifest.get('runtime') in ['408-CRO-1.3','408-CRO-1.4','408-CRO-1.5','408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'] and manifest.get('mobilePerformance',{}).get('build') == '408-CRO-1.3')
check('handoff manifest preserves CRO-1.4 low-friction intake', manifest.get('runtime') in ['408-CRO-1.4','408-CRO-1.5','408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'] and manifest.get('lowFrictionIntake',{}).get('build') == '408-CRO-1.4')
check('handoff manifest preserves CRO-1.5 accessibility polish', manifest.get('runtime') in ['408-CRO-1.5','408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'] and manifest.get('accessibilityAndResponsive',{}).get('build') == '408-CRO-1.5')
check('handoff manifest identifies CRO-1.6 promise consistency', manifest.get('runtime') in ['408-CRO-1.6','408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'] and manifest.get('promiseConsistency',{}).get('build') in ['408-CRO-1.6','408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7'])
check('contact choice manifest preserves CoverageFit', manifest.get('contactChoices',{}).get('coverageFitChanged') is False and manifest.get('receiver') in ['CoverageFit v3.20.51','CoverageFit v3.20.52','CoverageFit v3.20.53','CoverageFit v3.20.54','CoverageFit v3.20.55','CoverageFit v3.20.56','CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'])
check('handoff manifest launches assessment after transition', manifest.get('handoff',{}).get('next') == '/assessment/' and manifest.get('coverageFit',{}).get('zeroRepeat') is True)
check('handoff manifest lists seven personalized routes', len(manifest.get('routes',[])) == 7, str(len(manifest.get('routes',[]))))
check('handoff manifest identifies buyer concierge', manifest.get('buyer',{}).get('build') in ['408-BUY-1.1','408-BUY-1.2','408-BUY-1.3','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4'])
check('auto bundle continues to CoverageFit', 'data-coveragefit-after-submit="true"' in (root/'auto-bundle/index.html').read_text(encoding='utf-8'))
check('teachers route restored', (root/'teachers/index.html').stat().st_size > 1000)
check('teachers fallback restored', (root/'teachers/thank-you.html').stat().st_size > 500)
check('teachers campaign asset exists', (root/'shared/assets/teachers.png').is_file())

buyer=(root/'buyer/index.html').read_text(encoding='utf-8')
check('buyer route is text-first', 'Text Dylan at 408-FARMERS' in buyer and 'data-buyer-text-link' in buyer)
check('buyer route uses clean buyer-specific home image', '../shared/assets/buyer-home.jpg' in buyer and (root/'shared/assets/buyer-home.jpg').is_file())
check('buyer route offers online intake', 'data-buyer-start-online' in buyer and 'buyer_lander_form' in buyer)
check('buyer route loads buyer context before shared form controller', buyer.find('../shared/buyer-referral.js') < buyer.find('../shared/buyer-flow.js') < buyer.find('../shared/script.js'))
check('buyer route loads address module', buyer.find('../shared/address-autocomplete.js') < buyer.find('../shared/script.js'))
check('buyer route has partner fields', all(f'name="{field}"' in buyer for field in ['partner_id','partner_name','referral_source']))
check('buyer route has closing context', all(f'name="{field}"' in buyer for field in ['closing_date','occupancy','closing_urgency']))
check('buyer route owned by Worker', "'/buyer'" in (root/'_worker.js').read_text() and '/buyer/index.html' not in (root/'_redirects').read_text())
check('legacy Home alternate is absent', not (root/'home/Wowindex.html').exists())
check('legacy Home alternate permanently redirects', "path === '/home/Wowindex.html'" in (root/'_worker.js').read_text())
check('direct buyer referral pill has an explicit hidden rendering rule', '.buyer-referral-pill[hidden]{display:none!important}' in (root/'shared/buyer.css').read_text())

failed=[c for c in checks if not c['passed']]
result={'total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(root/'B1_2D_QA.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({'total':result['total'],'passed':result['passed'],'failed':result['failed']},indent=2))
if failed:
    for c in failed: print('FAIL',c['name'],c['detail'])
    sys.exit(1)
