#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const receiverRoot = process.env.COVERAGEFIT_ROOT || path.resolve(root, '../coveragefit');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
const checks = [];
const contract = JSON.parse(read('FLOW2_3_POST_LEAD_ENGAGEMENT_CONTRACT.json'));
const manifest = JSON.parse(read('handoff-manifest.json'));
const controller = read('shared/post-lead-engagement.js');
const submitter = read('shared/script.js');
const styles = read('shared/post-lead-engagement.css');

check('runtime preserves FLOW-2.3', ['408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()) && manifest.runtime === read('VERSION').trim());
check('manifest publishes the FLOW-2.3 contract', manifest.postLeadEngagementPayoff?.build === '408-FLOW-2.3' && manifest.postLeadEngagementPayoff?.contract === 'FLOW2_3_POST_LEAD_ENGAGEMENT_CONTRACT.json');
check('contract covers seven property acquisition routes', contract.routes.sort().join('|') === ['auto-bundle','buyer','engineers','healthcare','home','teachers','tech'].join('|'));

for (const route of contract.routes) {
  const html = read(`${route}/index.html`);
  const form = html.match(/<form\b[\s\S]*?<\/form>/)?.[0] || '';
  check(`${route} retains form-first lead capture`, form.includes('id="leadForm"') && form.includes('data-journey-stage="pre_review_intake"'));
  check(`${route} opts into post-lead engagement`, form.includes('data-post-lead-engagement="true"') && form.includes('data-post-lead-build="408-FLOW-2.3"'));
  check(`${route} loads controller and styles`, html.includes('post-lead-engagement.js?v=408-FLOW-2.3') && html.includes('post-lead-engagement.css?v=408-FLOW-2.3'));
  check(`${route} loads engagement before submitter`, html.indexOf('post-lead-engagement.js?v=408-FLOW-2.3') < html.indexOf('shared/script.js'));
  check(`${route} preserves required consent`, /name=["']consent["'][^>]*required|<input[^>]*required[^>]*name=["']consent["']/.test(form));
  check(`${route} retains CoverageFit only after submit`, form.includes('data-coveragefit-after-submit="true"'));
}

check('controller declares exactly three semantic questions', contract.questionCount === 3 && ['home_review_goal','housing_context','review_timing'].every(field => controller.includes(`field: '${field}'`)));
check('all semantic answers are bounded to contract values', Object.entries(contract.semanticFields).every(([field, values]) => values.every(value => controller.includes(`value: '${value}'`)) && controller.includes(`field: '${field}'`)));
check('controller is inserted after the lead form', controller.includes("form.insertAdjacentElement('afterend', panel)"));
check('question copy confirms no second lead', controller.includes('do not submit another lead'));
check('receipt status copy is truthful across all states', contract.leadStatuses.every(status => controller.includes(`${status}:`) || controller.includes(`'${status}':`)));
check('continuation is opt-in, never timed', controller.includes("[data-post-lead-review-options]") && controller.includes("[data-post-lead-later]") && !controller.includes('setTimeout'));
check('payoff promises score and saveable Snapshot', controller.includes('Protection Score') && controller.includes('save as a PDF or print'));
check('renter receives direct options instead of homeowner assessment', controller.includes("state.answers.housing_context === 'renter'") && submitter.includes("destinationType === 'renters'"));
check('profile is rebuilt after engagement before launch', submitter.indexOf('const currentProfile') < submitter.indexOf('CoverageFitLauncher.launch') && controller.includes('ProspectProfileBuilder?.fromForm?.(form)'));
check('post-lead controller intercepts before legacy automatic confirmation', submitter.indexOf('PostLeadEngagement.present') < submitter.indexOf('HomeLeadConfirmation.show'));
check('engagement controller performs no lead request', !/\bfetch\s*\(/.test(controller) && !controller.includes('formEndpoint'));
check('submitter retains exactly one network lead callsite', (submitter.match(/\bfetch\s*\(/g) || []).length === 1);
check('telemetry does not name personal or address fields', !['first_name','last_name','phone','email','property_address','consent'].some(field => controller.includes(`'${field}'`)));
check('accessibility includes native fieldset, progressbar, live region and error alert', controller.includes("createElement('fieldset')") && ['role="progressbar"','aria-live="polite"','role="alert"'].every(token => controller.includes(token)));
check('styles cover mobile, reduced motion and forced colors', styles.includes('@media(max-width:520px)') && styles.includes('@media(prefers-reduced-motion:reduce)') && styles.includes('@media(forced-colors:active)'));

const life = read('life/index.html');
check('Life remains excluded', !life.includes('post-lead-engagement') && contract.excludedProductFlows.join('|') === 'life');
const receiverVersion = fs.readFileSync(path.join(receiverRoot, 'VERSION'), 'utf8').trim();
check('receiver remains FLOW-2.3 compatible', ['3.20.61','3.20.62'].includes(receiverVersion) && ['CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver));
const score = fs.readFileSync(path.join(receiverRoot, 'assets/js/protection-score.js'));
check('Protection Score remains certified unchanged', crypto.createHash('sha256').update(score).digest('hex') === '0cf3190a5bb99aceb0e527f91268247481fd14e67acd81fb35db3accd8a5f2a8');

console.log(JSON.stringify({ sprint: '408-FLOW-2.3', passed: checks.length, failed: 0, checks }, null, 2));
