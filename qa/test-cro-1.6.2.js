#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const receiverRoot = path.resolve(process.env.COVERAGEFIT_ROOT || path.join(root, '..', 'coveragefit'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const contract = JSON.parse(read('professional-intent-contract.json'));
const manifest = JSON.parse(read('handoff-manifest.json'));
const promise = JSON.parse(read('promise-journey-contract.json'));
const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
const routes = ['healthcare/index.html','teachers/index.html','tech/index.html','engineers/index.html'];

check('sender preserves CRO-1.6.2 after the intent refinement', ['408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
check('shared contract identifies the paired receiver', ['408-CRO-1.6.2', '408-CRO-1.6.2.1'].includes(contract.sprint) && ['CoverageFit v3.20.52', 'CoverageFit v3.20.53','CoverageFit v3.20.54','CoverageFit v3.20.55','CoverageFit v3.20.56','CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(contract.receiver.release) && contract.automatedEligibilityDecision === false && contract.additionalQuestions === false);
check('manifest publishes professional continuity', ['408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(manifest.runtime) && ['CoverageFit v3.20.52', 'CoverageFit v3.20.53','CoverageFit v3.20.54','CoverageFit v3.20.55','CoverageFit v3.20.56','CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver) && manifest.professionalIntentContinuity?.contract === 'professional-intent-contract.json');
check('promise contract keeps licensed verification', ['408-CRO-1.6.2', '408-CRO-1.6.2.1'].includes(promise.build) && promise.professionalEligibilityReview.cta === 'See Which Professional Discounts May Apply' && promise.professionalEligibilityReview.verificationOwner === 'Dylan Haysbert');
check('homepage uses an inviting conditional action', read('index.html').match(/See which discounts may apply →/g)?.length === 4);

for (const rel of routes) {
  const markup = read(rel);
  check(`${rel}: keeps conditional qualification language`, markup.includes('may qualify') && markup.includes('Dylan verifies availability during quoting and underwriting.'));
  check(`${rel}: uses the inviting CTA`, markup.includes('See Which Professional Discounts May Apply'));
  check(`${rel}: preserves professional semantic handoff`, markup.includes('name="occupation_segment"') && (markup.includes('data-cro-context-field="occupation_segment"') || markup.includes('data-form-first="true"')) && markup.includes('_eligibility_form') && markup.includes('Professional eligibility and home coverage review'));
  check(`${rel}: makes no result promise`, !/you qualify|eligibility confirmed|guaranteed discount|instant eligibility/i.test(markup));
}

const progressive = read('shared/progressive-intake.js');
check('professional handoff keeps the original intent visible', progressive.includes("contextName === 'occupation_segment'") && progressive.includes('keeps your professional role connected') && progressive.includes('verify which Farmers professional discounts may be available during quoting and underwriting'));
check('non-professional handoff remains intact', progressive.includes('educational Protection Snapshot') && progressive.includes('what may deserve a closer look'));

check('paired CoverageFit release is available', fs.existsSync(path.join(receiverRoot, 'VERSION')) && ['3.20.52', '3.20.53', '3.20.54','3.20.55','3.20.56','3.20.57','3.20.58','3.20.59','3.20.60','3.20.61','3.20.62'].includes(fs.readFileSync(path.join(receiverRoot, 'VERSION'), 'utf8').trim()));
const receiverContract = JSON.parse(fs.readFileSync(path.join(receiverRoot, 'professional-intent-contract.json'), 'utf8'));
check('paired projects publish the same continuity contract', JSON.stringify(receiverContract) === JSON.stringify(contract));
check('CoverageFit packages the continuity module', fs.existsSync(path.join(receiverRoot, 'assets/js/professional-intent-continuity.js')));

console.log(JSON.stringify({ sprint: '408-CRO-1.6.2', passed: checks.length, failed: 0, checks }, null, 2));
