#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const receiverRoot = process.env.COVERAGEFIT_ROOT || path.resolve(root, '../coveragefit');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
const contract = JSON.parse(read('FLOW2_4_OPTIONAL_COVERAGEFIT_INVITATION_CONTRACT.json'));
const manifest = JSON.parse(read('handoff-manifest.json'));
const invitation = read('shared/coveragefit-invitation.js');
const engagement = read('shared/post-lead-engagement.js');
const submitter = read('shared/script.js');
const styles = read('shared/coveragefit-invitation.css');

check('runtime preserves FLOW-2.4', ['408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()) && manifest.runtime === read('VERSION').trim());
check('manifest preserves the invitation contract', ['408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(manifest.optionalCoverageFitInvitation?.build) && manifest.optionalCoverageFitInvitation?.contract === 'FLOW2_4_OPTIONAL_COVERAGEFIT_INVITATION_CONTRACT.json');
check('contract covers all seven property funnels', contract.routes.sort().join('|') === ['auto-bundle','buyer','engineers','healthcare','home','teachers','tech'].join('|'));

for (const route of contract.routes) {
  const html = read(`${route}/index.html`);
  const form = html.match(/<form\b[\s\S]*?<\/form>/)?.[0] || '';
  check(`${route} retains FLOW-2.3 post-lead engagement`, form.includes('data-post-lead-engagement="true"') && html.includes('post-lead-engagement.js?v=408-FLOW-2.3'));
  check(`${route} opts into FLOW-2.4 invitation`, form.includes('data-coveragefit-invitation="true"') && /data-coveragefit-invitation-build="408-(?:FLOW-2\.4|CF-RPT-1\.1)"/.test(form));
  check(`${route} loads invitation styles and controller`, /coveragefit-invitation\.css\?v=408-(?:FLOW-2\.4|CF-RPT-1\.1)/.test(html) && /coveragefit-invitation\.js\?v=408-(?:FLOW-2\.4|CF-RPT-1\.1)/.test(html));
  const invitationScriptIndex = html.search(/coveragefit-invitation\.js\?v=408-(?:FLOW-2\.4|CF-RPT-1\.1)/);
  check(`${route} orders engagement, invitation, then submitter`, html.indexOf('post-lead-engagement.js?v=408-FLOW-2.3') < invitationScriptIndex && invitationScriptIndex < html.indexOf('shared/script.js'));
  check(`${route} remains form-first with one required consent`, form.includes('id="leadForm"') && form.includes('data-journey-stage="pre_review_intake"') && (form.match(/name=["']consent["']/g) || []).length === 1 && /name=["']consent["'][^>]*required|<input[^>]*required[^>]*name=["']consent["']/.test(form));
}

check('invitation states the lead is already submitted', invitation.includes('Your request is complete.') && invitation.includes('Your information is already submitted'));
check('invitation explicitly asks the optional question', invitation.includes('Would you like to get a head start on Dylan’s review?'));
check('accept choice explains Protection Score and saveable report', invitation.includes('Continue to CoverageFit') && invitation.includes('Protection Score') && invitation.includes('save as a PDF or print'));
check('defer choice clearly stops now', invitation.includes('Finish for Now') && invitation.includes('No additional questions right now'));
check('accept and defer are separate native buttons', invitation.includes('data-coveragefit-invitation-continue') && invitation.includes('data-coveragefit-invitation-finish'));
check('invitation has no timer or automatic continuation', !invitation.includes('setTimeout') && !invitation.includes('setInterval') && !invitation.includes('automatic'));
check('launcher callback occurs only in accept handler', invitation.indexOf("continueButton.addEventListener('click'") < invitation.indexOf('state.onContinue()') && invitation.indexOf("finishButton.addEventListener('click'") > invitation.indexOf('state.onContinue()'));
check('finish path never invokes the continuation callback', !invitation.slice(invitation.indexOf("finishButton.addEventListener('click'"), invitation.indexOf("backButton.addEventListener('click'")).includes('onContinue'));
check('post-lead payoff opens invitation instead of launching directly', engagement.includes('post_lead_invitation_requested') && engagement.includes('CoverageFitInvitation.present') && engagement.includes('data-post-lead-review-options'));
check('post-lead explicit fallback is click-bound and not timed', engagement.includes("panel.querySelector('[data-post-lead-review-options]').addEventListener('click'") && !engagement.includes('setTimeout'));
check('submitter offers invitation before legacy confirmation', submitter.indexOf('CoverageFitInvitation.present') < submitter.indexOf('HomeLeadConfirmation.show'));
check('invitation-enabled degraded path returns before legacy confirmation', submitter.indexOf("if (form.dataset.coveragefitInvitation === 'true')") < submitter.indexOf('HomeLeadConfirmation.show') && submitter.includes('button.type = \'button\''));
check('degraded path labels continuation optional', submitter.includes('Continue to CoverageFit (Optional)') && submitter.includes('CoverageFit is optional'));
const home = read('home/index.html');
check('Home retires the timed confirmation asset and markup', !home.includes('home-confirmation.js') && !home.includes('home-confirmation.css') && !home.includes('data-home-confirmation-panel') && !home.includes('Opening CoverageFit automatically'));
check('invitation creates no second lead request', !/\bfetch\s*\(/.test(invitation) && !/\bfetch\s*\(/.test(engagement) && (submitter.match(/\bfetch\s*\(/g) || []).length === 1);
check('renter invitation replaces homeowner assessment', invitation.includes("settings.destinationType === 'renters'") && invitation.includes('View Renters Options') && invitation.includes('Skip the homeowner assessment'));
check('telemetry excludes personal and property data', !['first_name','last_name','phone','email','property_address','consent'].some(field => invitation.includes(`'${field}'`)));
check('invitation is accessible', invitation.includes('role="group"') && invitation.includes('aria-live="polite"') && invitation.includes('type="button"'));
check('styles support mobile, reduced motion, forced colors and 44px targets', styles.includes('@media(max-width:620px)') && styles.includes('@media(prefers-reduced-motion:reduce)') && styles.includes('@media(forced-colors:active)') && styles.includes('min-height:44px'));

check('Life remains excluded', !read('life/index.html').includes('coveragefit-invitation') && contract.excludedProductFlows.join('|') === 'life');
check('receiver preserves FLOW-2.4 compatibility', ['3.20.61','3.20.62'].includes(fs.readFileSync(path.join(receiverRoot, 'VERSION'), 'utf8').trim()));
check('Protection Score remains unchanged', crypto.createHash('sha256').update(fs.readFileSync(path.join(receiverRoot, 'assets/js/protection-score.js'))).digest('hex') === '0cf3190a5bb99aceb0e527f91268247481fd14e67acd81fb35db3accd8a5f2a8');

console.log(JSON.stringify({ sprint: '408-FLOW-2.4', passed: checks.length, failed: 0, checks }, null, 2));
