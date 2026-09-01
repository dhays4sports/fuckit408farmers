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
const confirmation = read('shared/home-confirmation.js');
const styles = read('shared/home-confirmation.css');
const submit = read('shared/script.js');
const baseline = read('shared/home-baseline.js');
const manifest = JSON.parse(read('handoff-manifest.json'));
const confirmationContract = JSON.parse(read('HOME2_5_CONFIRMATION_CONTRACT.json'));
const journeyJson = JSON.parse(read('HOME2_5_JOURNEY_CONTRACT.json'));
const journey = require(path.join(root, 'shared/home-journey-contract.js'));

check('release preserves HOME-2.5 after later HOME releases', ['408-HOME-2.5', '408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(version) && ['408-HOME-2.5', '408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9'].includes(journey.BUILD) && ['1.4', '1.5', '1.6'].includes(journey.VERSION));
check('machine-readable HOME-2.5 contract remains immutable', journeyJson.build === '408-HOME-2.5' && journeyJson.version === '1.4' && journeyJson.contract === journey.CONTRACT);
check('Home fingerprints and confirmation assets remain synchronized', home.includes(`data-sender-build="${journey.BUILD}"`) && home.includes(`home-confirmation.js?v=${journey.BUILD}`) && home.includes(`home-confirmation.css?v=${journey.BUILD}`));
check('confirmation is an opt-in hidden progressive stage', home.includes('data-home-confirmation="true"') && home.includes('data-home-confirmation-delay="1250"') && /data-home-confirmation-panel hidden/.test(home));
check('all four honest lead states have distinct copy', ['confirmed', 'pending', 'unconfirmed', "'local-fallback'"].every(state => confirmation.includes(state)) && confirmation.includes('Delivery could not be confirmed yet'));
check('only a confirmed request claims receipt', confirmation.includes("confirmed: Object.freeze") && confirmation.includes("kicker: 'Request received'") && !/unconfirmed:[\s\S]{0,160}Request received/.test(confirmation));
check('automatic continuation is bounded and manually available', confirmation.includes("window.setTimeout(function () { finish('automatic'); }, delay)") && confirmation.includes("finish('manual')") && confirmationContract.manualContinueAvailable === true);
check('confirmation failure falls back to established handoff', submit.includes('if (!confirmationStarted) openDestination()') && confirmationContract.fallback.includes('immediate destination handoff'));
check('homeowner copy explains one-time property confirmation', home.includes('confirm the property once') && confirmationContract.homeownerDestination.propertyConfirmation === 'one-time CoverageFit confirmation');
check('CoverageFit launch occurs only after confirmation continues', submit.indexOf('const openDestination') < submit.indexOf('HomeLeadConfirmation.show') && submit.includes('onContinue: openDestination'));
check('CoverageFit launch still targets existing Home assessment', home.includes('data-cf-next="/assessment/"') && submit.includes("next: form.dataset.cfNext || '/assessment/'"));
check('renter keeps direct destination and bypasses homeowner assessment', confirmation.includes("destinationType === 'renters'") && confirmation.includes('instead of sending you into the homeowner assessment') && home.includes('data-cf-renter-destination="/contact/?intent=renters"'));
check('lead status emits before either destination branch', submit.indexOf('emitLeadSubmissionStatus(leadCaptureStatus)') < submit.indexOf('const openDestination'));
check('confirmation events extend the journey contract', ['CONFIRMATION_VIEWED', 'CONFIRMATION_CONTINUED'].every(name => journey.EVENTS[name] && confirmation.includes(name)));
check('confirmation telemetry is bounded and excludes PII fields', ['continuation_trigger', 'destination_type'].every(key => baseline.includes(`'${key}'`)) && !['first_name', 'last_name', 'phone', 'email', 'property_address'].some(key => baseline.includes(key)));
check('confirmation styles cover responsive, reduced motion, and forced colors', styles.includes('@media(max-width:520px)') && styles.includes('prefers-reduced-motion') && styles.includes('forced-colors'));
check('manifest preserves HOME-2.5 confirmation with the current receiver', manifest.runtime === version && manifest.homeConfirmationContinuation?.build === '408-HOME-2.5' && manifest.homeConfirmationContinuation?.coverageFitChanged === false && ['CoverageFit v3.20.56', 'CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver));
check('Formspree grace, two lead points, assessment, and score remain unchanged', submit.includes('LEAD_SUBMISSION_GRACE_MS = 900') && manifest.homeConfirmationContinuation?.leadPointsPreserved === 2 && manifest.homeConfirmationContinuation?.assessmentQuestionsChanged === false && manifest.homeConfirmationContinuation?.protectionScoreChanged === false);
check('no-JavaScript lead form remains complete', !/<form[^>]+id="leadForm"[^>]+hidden/.test(home) && !/<fieldset[^>]+data-home-lead-step="[12]"[^>]+hidden/.test(home));

console.log(`408-HOME-2.5 QA: ${checks.length}/${checks.length} passed`);
