#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];
const check = (name, condition) => { assert(condition, name); checks.push(name); };

const version = read('VERSION').trim();
const home = read('home/index.html');
const progressive = read('shared/home-lead-progressive.js');
const engagement = read('shared/home-engagement.js');
const styles = read('shared/home-lead-progressive.css');
const baseline = read('shared/home-baseline.js');
const submit = read('shared/script.js');
const manifest = JSON.parse(read('handoff-manifest.json'));
const leadContract = JSON.parse(read('HOME2_4_PROGRESSIVE_LEAD_CONTRACT.json'));
const journeyJson = JSON.parse(read('HOME2_4_JOURNEY_CONTRACT.json'));
const journey = require(path.join(root, 'shared/home-journey-contract.js'));

check('release preserves the HOME-2.4 progressive capture', ['408-HOME-2.4', '408-HOME-2.5', '408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(version) && ['408-HOME-2.4', '408-HOME-2.5', '408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9'].includes(journey.BUILD) && ['1.3', '1.4', '1.5', '1.6'].includes(journey.VERSION));
check('HOME-2.4 machine-readable contract remains immutable', journeyJson.build === '408-HOME-2.4' && journeyJson.version === '1.3' && journeyJson.contract === journey.CONTRACT);
check('Home fingerprints and progressive assets remain synchronized', home.includes(`data-sender-build="${journey.BUILD}"`) && home.includes(`data-home-journey-build="${journey.BUILD}"`) && home.includes(`home-lead-progressive.js?v=${journey.BUILD}`));
check('lead form declares progressive enhancement', home.includes('data-home-progressive-lead="true"') && progressive.includes('408farmers:home-lead-revealed'));
check('payoff reveal activates lead progression', engagement.includes("CustomEvent('408farmers:home-lead-revealed'") && engagement.includes('housing_context: semantic.housingContext'));
check('two lead fieldsets preserve existing field names', (home.match(/data-home-lead-step="[12]"/g) || []).length === 2 && ['first_name', 'last_name', 'phone', 'email', 'property_address', 'review_context', 'consent'].every(name => home.includes(`name="${name}"`)));
check('contact fields are isolated in step one', home.indexOf('data-home-lead-step="1"') < home.indexOf('name="first_name"') && home.indexOf('name="email"') < home.indexOf('data-home-lead-step="2"'));
check('property and consent are isolated in step two', home.indexOf('data-home-lead-step="2"') < home.indexOf('name="property_address"') && home.indexOf('name="property_address"') < home.indexOf('name="consent"'));
check('progressive controls are hidden in HTML for no-JavaScript fallback', home.includes('data-home-lead-progress hidden') && home.includes('data-home-lead-next hidden') && home.includes('data-home-lead-back hidden'));
check('complete no-JavaScript form remains visible', !/<fieldset[^>]+data-home-lead-step="[12]"[^>]+hidden/.test(home) && !/<form[^>]+id="leadForm"[^>]+hidden/.test(home));
check('review context remains visible without JS and in enhanced form-first mode', home.includes('data-home-review-context') && !/data-home-review-context[^>]+hidden/.test(home) && styles.includes('.home-lead-progressive-active [data-home-review-context][hidden]') && progressive.includes('setReviewContextVisible(Boolean(formFirst))'));
check('step one validates all contact fields', ['first_name', 'last_name', 'phone', 'email'].every(name => progressive.includes(`'${name}'`)) && progressive.includes('field.checkValidity()'));
check('phone validation retains ten-digit minimum', progressive.includes("replace(/\\D/g, '')") && progressive.includes('digits.length >= 10'));
check('Enter on step one advances without submission', progressive.includes("form.addEventListener('submit'") && progressive.includes('event.stopImmediatePropagation()') && progressive.includes('continueToProperty()'));
check('Back returns to contact step with values retained', progressive.includes("back.addEventListener('click'") && progressive.includes('showStep(0, { focus: true })'));
check('renter skips property address and retains lead-first direct branch', progressive.includes('propertyAddress.required = false') && progressive.includes('propertyFields.hidden = true') && (submit.includes("value !== 'renter'") || submit.includes("destinationType === 'renters'")) && home.includes('data-cf-renter-destination="/contact/?intent=renters"'));
check('non-renter property address remains required', progressive.includes('propertyAddress.required = true') && progressive.includes("housingContext === 'renter'"));
check('consent remains required and unchanged', home.includes('<input name="consent" required="" type="checkbox"/>') && home.includes('Consent is not a condition of purchase. Message and data rates may apply.'));
check('four progressive lead events extend the journey', ['LEAD_CAPTURE_PRESENTED', 'LEAD_CAPTURE_STEP_VIEWED', 'LEAD_CAPTURE_STEP_COMPLETED', 'LEAD_CAPTURE_BACK_SELECTED'].every(name => journey.EVENTS[name] && progressive.includes(name)));
check('step telemetry excludes identity and address', !['first_name', 'last_name', 'phone', 'email', 'property_address'].some(key => baseline.includes(key)) && leadContract.stepCount === 2);
check('responsive, reduced-motion, and forced-color styles are present', styles.includes('@media(max-width:520px)') && styles.includes('prefers-reduced-motion') && styles.includes('forced-colors'));
check('manifest preserves progressive capture with current receiver', manifest.runtime === version && manifest.homeProgressiveLeadCapture?.stepCount === 2 && manifest.homeProgressiveLeadCapture?.coverageFitChanged === false && ['CoverageFit v3.20.56', 'CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver));
check('assessment and score remain out of scope', manifest.homeProgressiveLeadCapture?.assessmentQuestionsChanged === false && manifest.homeProgressiveLeadCapture?.protectionScoreChanged === false);
check('Formspree hard gate and zero-repeat handoff remain intact', submit.includes('await submitLead()') && submit.includes('nativeFormspreeFallback') && home.includes('data-cf-next="/assessment/"'));
check('HOME-2.4 points to the implemented confirmation sprint', manifest.homeJourneyFoundation?.nextSprint === null && leadContract.nextSprint === '408-HOME-2.5');

console.log(`408-HOME-2.4 QA: ${checks.length}/${checks.length} passed`);
