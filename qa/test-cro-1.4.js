#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const receiverRoot = process.env.COVERAGEFIT_ROOT || path.resolve(root, '..', 'coveragefit');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const manifest = JSON.parse(read('handoff-manifest.json'));
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
const formFirstSuccessor = read('VERSION').trim() === '408-FLOW-2.2';

const routes = {
  'auto-bundle/index.html': ['housing_context', 'auto_bundle_form'],
  'healthcare/index.html': ['occupation_segment', 'healthcare_eligibility_form'],
  'teachers/index.html': ['occupation_segment', 'teachers_eligibility_form'],
  'tech/index.html': ['occupation_segment', 'tech_eligibility_form'],
  'engineers/index.html': ['occupation_segment', 'engineers_eligibility_form']
};

check('runtime preserves low-friction intake after later CRO work', ['408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
check('manifest preserves the bounded intake contract', ['408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(manifest.runtime) && manifest.lowFrictionIntake?.build === '408-CRO-1.4');
check('manifest records two bounded steps', JSON.stringify(manifest.lowFrictionIntake?.steps) === JSON.stringify(['campaign_context', 'contact_property_consent']));
check('manifest records one property-address collection point', manifest.lowFrictionIntake?.propertyAddressCollection === '408farmers_step_2' && /does not repeat/.test(manifest.lowFrictionIntake?.propertyAddressContinuation || ''));
check('Buyer and CoverageFit are explicitly unchanged', manifest.lowFrictionIntake?.buyerFlowChanged === false && manifest.lowFrictionIntake?.coverageFitChanged === false);
check('shared progressive assets are packaged and imported', exists('shared/progressive-intake.js') && exists('shared/progressive-intake.css') && read('shared/styles.css').includes('@import url("./progressive-intake.css")'));

for (const [rel, [contextField, entry]] of Object.entries(routes)) {
  const markup = read(rel);
  check(`${rel}: preserves bounded intake under the current presentation`, formFirstSuccessor ? (markup.includes('data-form-first="true"') && markup.includes('data-form-first-build="408-FLOW-2.2"')) : (markup.includes('data-cro-progressive="true"') && markup.includes(`data-cro-context-field="${contextField}"`)));
  check(`${rel}: keeps its stable entry and assessment`, markup.includes(`data-cf-entry="${entry}"`) && markup.includes('data-cf-assessment="home"') && markup.includes('data-cf-next="/assessment/"'));
  check(`${rel}: runtime ordering matches the current presentation`, formFirstSuccessor ? (!markup.includes('../shared/progressive-intake.js') && markup.indexOf('../shared/prospect-profile.js') < markup.indexOf('../shared/script.js')) : (markup.indexOf('../shared/prospect-profile.js') < markup.indexOf('../shared/progressive-intake.js') && markup.indexOf('../shared/progressive-intake.js') < markup.indexOf('../shared/script.js')));
  check(`${rel}: asks property address exactly once`, (markup.match(/name="property_address"/g) || []).length === 1 && /name="property_address"[^>]*required/.test(markup));
  check(`${rel}: asks campaign context exactly once`, (markup.match(new RegExp(`name="${contextField}"`, 'g')) || []).length === 1);
  check(`${rel}: preserves contact and explicit consent fields`, ['first_name', 'last_name', 'phone', 'email', 'consent'].every(name => markup.includes(`name="${name}"`)));
  check(`${rel}: preserves zero-repeat launch attributes`, markup.includes('data-coveragefit-after-submit="true"') && markup.includes('data-handoff-contract="coveragefit-handoff-v1"'));
}

const home = read('home/index.html');
const buyer = read('buyer/index.html');
check('Home is not enrolled in CRO-1.4', !home.includes('progressive-intake.js') && !home.includes('data-cro-progressive'));
check('Buyer keeps its established engine and is not enrolled twice', buyer.includes('../shared/buyer-flow.js') && !buyer.includes('progressive-intake.js') && !buyer.includes('data-cro-progressive'));

const controller = read('shared/progressive-intake.js');
check('controller exposes visible progress and two named steps', controller.includes('Step 1 of 2') && controller.includes('Your situation') && controller.includes('Contact &amp; property'));
check('controller preserves the zero-repeat post-submit expectation after later promise work', (controller.includes('will not enter the property address again') && controller.includes('Dylan personally reviews')) || (controller.includes('without entering the property address again') && controller.includes('educational Protection Snapshot')));
check('controller recovers invalid steps and focus', controller.includes('firstInvalid') && controller.includes('setStep(index') && controller.includes('focusControl(control)'));
check('controller retains a Back path and value-preserving DOM moves', controller.includes('dataset.croBack') && controller.includes('row.append(label)'));
check('controller emits bounded non-PII funnel events', ['cro_form_start', 'cro_form_step_view', 'cro_form_step_complete', 'cro_form_validation_error', 'cro_form_submit_attempt'].every(event => controller.includes(event)) && !controller.includes('FormData') && !controller.includes('leadSnapshot'));
check('controller does not create a second profile or launch engine', !controller.includes('ProspectProfileBuilder') && !controller.includes('CoverageFitLauncher'));

const css = read('shared/progressive-intake.css');
check('intake styles cover progress, focus, mobile, and reduced motion', ['.cro-progress-track', ':focus-visible', '@media (max-width: 700px)', 'prefers-reduced-motion'].every(token => css.includes(token)));

const submitController = read('shared/script.js');
check('fail-open delivery remains bounded and unchanged', submitController.includes('LEAD_SUBMISSION_GRACE_MS = 900') && submitController.includes("resolve('pending')") && submitController.includes('continueToCoverageFit(leadCaptureStatus)'));
check('canonical profile and consent handoff remain unchanged', submitController.includes('ProspectProfileBuilder.fromForm(form)') && submitController.includes("contact_consent: contactConsentConfirmed ? 'true' : 'false'"));

check('paired CoverageFit source is available for zero-repeat certification', fs.existsSync(path.join(receiverRoot, 'assets/js/prefill-intake.js')));
const receiverPrefill = fs.readFileSync(path.join(receiverRoot, 'assets/js/prefill-intake.js'), 'utf8');
check('CoverageFit consumes property address in its canonical prefill', receiverPrefill.includes("'property_address'") && receiverPrefill.includes("params.get('property_address')"));
check('sprint documentation records the bounded receiver decision', exists('SPRINT-408-CRO-1.4.md') && /CoverageFit was inspected and regression-tested but not modified/.test(read('SPRINT-408-CRO-1.4.md')));

console.log(JSON.stringify({ sprint: '408-CRO-1.4', passed: checks.length, failed: 0, checks }, null, 2));
