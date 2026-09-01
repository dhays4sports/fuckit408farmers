#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const senderRoot = path.resolve(__dirname, '..');
const receiverRoot = path.resolve(process.env.COVERAGEFIT_ROOT || path.join(senderRoot, '..', 'coveragefit'));
const read = (root, relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const hash = (root, relative) => crypto.createHash('sha256').update(read(root, relative)).digest('hex');
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

const contract = JSON.parse(read(senderRoot, 'FLOW2_5_END_TO_END_CONVERSION_CONTRACT.json'));
const manifest = JSON.parse(read(senderRoot, 'handoff-manifest.json'));
const engagement = read(senderRoot, 'shared/post-lead-engagement.js');
const invitation = read(senderRoot, 'shared/coveragefit-invitation.js');
const submitter = read(senderRoot, 'shared/script.js');
const launcher = read(senderRoot, 'shared/coveragefit-launch.js');
const profile = read(senderRoot, 'shared/prospect-profile.js');
const prefill = read(receiverRoot, 'assets/js/prefill-intake.js');
const receiverContext = read(receiverRoot, 'assets/js/personalization-context.js');
const receiverJourney = read(receiverRoot, 'assets/js/home-journey-baseline.js');
const assessmentHtml = read(receiverRoot, 'assessment/index.html');
const assessment = read(receiverRoot, 'assets/js/assessment-engine.js');
const consultation = read(receiverRoot, 'assets/js/consultation-records.js');
const reportHtml = read(receiverRoot, 'home/report/index.html');
const reportEngine = read(receiverRoot, 'assets/js/report-engine.js');

check('release advances to 408-FLOW-2.5', read(senderRoot, 'VERSION').trim() === '408-FLOW-2.5' && manifest.runtime === '408-FLOW-2.5');
check('contract synchronizes CoverageFit 3.20.62', contract.receiver === 'CoverageFit v3.20.62' && read(receiverRoot, 'VERSION').trim() === '3.20.62');
check('manifest publishes FLOW-2.5 certification', manifest.endToEndConversionCertification?.build === '408-FLOW-2.5' && manifest.endToEndConversionCertification?.contract === 'FLOW2_5_END_TO_END_CONVERSION_CONTRACT.json');
check('sprint and production runbook are packaged', fs.existsSync(path.join(senderRoot, 'SPRINT-408-FLOW-2.5.md')) && fs.existsSync(path.join(senderRoot, contract.certificationBoundary.productionRunbook)));

check('all seven property funnels are certified', contract.routes.sort().join('|') === ['auto-bundle','buyer','engineers','healthcare','home','teachers','tech'].join('|'));
for (const route of contract.routes) {
  const html = read(senderRoot, `${route}/index.html`);
  const form = html.match(/<form\b[\s\S]*?<\/form>/)?.[0] || '';
  check(`${route} is form-first`, form.includes('data-journey-stage="pre_review_intake"') && form.includes('id="leadForm"'));
  check(`${route} retains one required consent`, (form.match(/name=["']consent["']/g) || []).length === 1 && /name=["']consent["'][^>]*required|<input[^>]*required[^>]*name=["']consent["']/.test(form));
  check(`${route} enables post-lead questions and invitation`, form.includes('data-post-lead-engagement="true"') && form.includes('data-coveragefit-invitation="true"'));
  check(`${route} loads engagement then invitation then submitter`, html.indexOf('post-lead-engagement.js') < html.indexOf('coveragefit-invitation.js') && html.indexOf('coveragefit-invitation.js') < html.indexOf('shared/script.js'));
  check(`${route} transfers into the existing Home assessment`, form.includes('data-cf-assessment="home"') && form.includes('data-cf-next="/assessment/"'));
}

check('first lead resolves to a receipt status before post-lead continuation', submitter.includes('const leadCaptureStatus = await Promise.race') && submitter.indexOf('const leadCaptureStatus = await Promise.race') < submitter.lastIndexOf('continueToCoverageFit(leadCaptureStatus)'));
check('sender performs one network lead callsite', (submitter.match(/\bfetch\s*\(/g) || []).length === 1);
check('questions and invitation create no lead requests', !/\bfetch\s*\(/.test(engagement) && !/\bfetch\s*\(/.test(invitation));
check('three bounded intent fields are the only engagement fields', ['home_review_goal','housing_context','review_timing'].every(field => engagement.includes(`field: '${field}'`)) && (engagement.match(/field: '/g) || []).length === 3);
check('all lead receipt states are handled', contract.leadStatuses.every(status => engagement.includes(status === 'local-fallback' ? "'local-fallback':" : `${status}:`)));
check('personalized payoff precedes optional invitation', engagement.indexOf('showPayoff()') < engagement.indexOf("[data-post-lead-review-options]") && engagement.includes('CoverageFitInvitation.present'));
check('CoverageFit requires an explicit accept click', invitation.indexOf("continueButton.addEventListener('click'") < invitation.indexOf('state.onContinue()'));
check('Finish for Now never launches CoverageFit', !invitation.slice(invitation.indexOf("finishButton.addEventListener('click'"), invitation.indexOf("backButton.addEventListener('click'")).includes('onContinue'));
check('no automatic or timer invitation launch exists', !invitation.includes('setTimeout') && !invitation.includes('setInterval'));
check('degraded controller path remains explicit-click gated', submitter.includes("if (form.dataset.coveragefitInvitation === 'true')") && submitter.includes("button.addEventListener('click', openDestination, { once: true })"));
check('renter branch bypasses Home assessment', submitter.includes("event: 'renters_direct_review_handoff'") && invitation.includes('Skip the homeowner assessment'));
check('LIFE remains outside the property conversion flow', !read(senderRoot, 'life/index.html').includes('coveragefit-invitation'));

check('sender allowlists contact property intent and attribution', ['firstName','lastName','phone','email','propertyAddress','homeReviewGoal','housingContext','reviewTiming','campaignId','campaignVariant','campaignZip'].every(field => profile.includes(field)));
check('launcher targets the canonical transition and assessment', launcher.includes("baseUrl: 'https://coveragefit.com/transition/'") && launcher.includes("url.searchParams.set('next', config.next || '/home/')"));
check('launcher transfers consent and capture state once', submitter.includes('contact_consent:') && submitter.includes('lead_capture_status:') && submitter.includes('handoff_contract:'));
check('receiver captures and stores the handoff profile', prefill.includes('safeSet(sessionStorage, SESSION_STORAGE_KEY, profile)') && prefill.includes('safeSet(localStorage, LOCAL_STORAGE_KEY, profile)'));
check('receiver scrubs personal intent and consent markers from visible URL', prefill.includes('PII_KEYS.concat(MARKER_KEYS).forEach') && prefill.includes('window.history.replaceState'));
check('receiver preserves the three intent fields', ['homeReviewGoal','housingContext','reviewTiming'].every(field => prefill.includes(field) && receiverContext.includes(field)));
check('intent stays outside Protection Score implementation', !['homeReviewGoal','housingContext','reviewTiming','home_review_goal','housing_context','review_timing'].some(field => read(receiverRoot, 'assets/js/protection-score.js').includes(field)));

check('question two remains observer-free', !assessmentHtml.includes('id="earlyInsight"') && ![...assessmentHtml.matchAll(/<script\s+[^>]*src="([^"]+)"/g)].filter(match => match[1].startsWith('/')).some(match => read(receiverRoot, match[1].slice(1)).includes('MutationObserver')));
check('assessment emits start and completion conversion evidence', assessment.includes("track('assessment_started'") && assessment.includes("track('assessment_completed'"));
check('Home journey vocabulary exposes assessment start and completion', receiverJourney.includes("event: 'home_assessment_started'") && receiverJourney.includes("event: 'home_assessment_completed'"));
check('zero-repeat completion reuses connected contact and permission', assessment.includes('startZeroRepeatCompletion') && assessment.includes('No repeated form needed.') && assessment.includes('contact information and permission from your 408FARMERS request'));
check('completed assessment creates private report before consultation', assessment.indexOf('CoverageFitProspectReports.create') < assessment.indexOf('CoverageFitConsultationRecords'));
check('completed assessment submits the existing second consultation intake', assessment.includes("fetch(this.action") && assessment.includes('CoverageFitRemoteConsultations.submit'));
check('consultation record is marked ready through the existing store', assessment.includes("status: 'ready'") && assessment.includes('records.createId') && assessment.includes('records.upsert') && consultation.includes('createId'));
check('private report access uses an opaque fragment', reportHtml.includes('noindex, nofollow') && read(receiverRoot, 'assets/js/prospect-report-access.js').includes('#report_id='));
check('report promise is delivered visibly', reportHtml.includes('Save as PDF / Print') && reportHtml.includes('choose a printer for a paper copy'));
check('report delivery invokes print without another lead request', reportEngine.includes('window.print()') && !/\bfetch\s*\(/.test(reportEngine.slice(reportEngine.indexOf('function openPrintDelivery'), reportEngine.indexOf("track('report_viewed'"))));
check('report view and save action are measurable', reportEngine.includes("'protection_report_save_print_selected'") && reportEngine.includes("track('report_viewed'"));

check('Protection Score is byte-certified', hash(receiverRoot, 'assets/js/protection-score.js') === contract.frozen.protectionScoreSha256);
check('Home assessment configuration is byte-certified', hash(receiverRoot, 'home/assessment-config.js') === contract.frozen.homeAssessmentConfigSha256);
check('sender runtime is unchanged by certification', contract.frozen.senderRuntimeFiles.every(file => hash(senderRoot, file) === contract.frozen.senderRuntimeSha256[file]));
check('certification truthfully leaves live production gates open', contract.certificationBoundary.sourceCertified === true && contract.certificationBoundary.liveDeploymentPerformed === false && contract.certificationBoundary.realFormspreeReceiptVerified === false && contract.certificationBoundary.liveCloudflareD1RecordVerified === false && contract.certificationBoundary.physicalDevicePdfVerified === false);

console.log(JSON.stringify({ sprint: '408-FLOW-2.5', passed: checks.length, failed: 0, checks }, null, 2));
