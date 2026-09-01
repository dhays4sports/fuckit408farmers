#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const receiverRoot = process.env.COVERAGEFIT_ROOT || path.resolve(root, '..', 'coveragefit');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const contract = JSON.parse(read('promise-journey-contract.json'));
const manifest = JSON.parse(read('handoff-manifest.json'));
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

const routes = {
  'healthcare/index.html': { entry: 'healthcare_eligibility_form', hero: 'Your healthcare role may qualify you for Farmers professional discounts.' },
  'teachers/index.html': { entry: 'teachers_eligibility_form', hero: 'Teachers and school employees may qualify for Farmers professional discounts.' },
  'tech/index.html': { entry: 'tech_eligibility_form', hero: 'Your technology role may qualify you for Farmers professional discounts.' },
  'engineers/index.html': { entry: 'engineers_eligibility_form', hero: 'Your engineering field may qualify you for Farmers professional discounts.' }
};

check('runtime identifies the corrective release', ['408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
check('contract records a licensed eligibility review without an automated decision', ['408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1'].includes(contract.build) && contract.professionalEligibilityReview?.automatedDecision === false && contract.professionalEligibilityReview?.verificationOwner === 'Dylan Haysbert' && contract.professionalEligibilityReview?.verificationStage === 'quoting_and_underwriting');
check('manifest publishes the bounded occupational review', ['408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(manifest.runtime) && ['408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1'].includes(manifest.occupationalEligibilityReview?.build) && typeof manifest.occupationalEligibilityReview?.coverageFitChanged === 'boolean');

const rootMarkup = read('index.html');
check('homepage restores the eligibility-review proposition', rootMarkup.includes('Your profession may qualify you for additional discounts.') && rootMarkup.includes('connect your professional role to a broader coverage review') && ['Review my eligibility →', 'See which discounts may apply →'].some(label => rootMarkup.split(label).length - 1 === 4));

for (const [rel, expected] of Object.entries(routes)) {
  const markup = read(rel);
  check(`${rel}: states a conditional professional-discount opportunity`, markup.includes(expected.hero));
  check(`${rel}: assigns verification to Dylan`, markup.includes('Dylan verifies availability during quoting and underwriting.') && markup.includes('verify which Farmers professional discounts may be available'));
  check(`${rel}: restores an explicit eligibility-review CTA`, markup.includes('Professional Discount Eligibility Review') && markup.includes('See which professional discounts may apply') && ['Review My Professional Discount Eligibility', 'See Which Professional Discounts May Apply'].some(label => markup.includes(label)));
  check(`${rel}: preserves occupational-flow identity`, markup.includes(`data-cf-entry="${expected.entry}"`) && markup.includes('name="occupation_segment"') && (markup.includes('data-cro-context-field="occupation_segment"') || markup.includes('data-form-first="true"')) && markup.includes('Professional eligibility and home coverage review'));
  check(`${rel}: preserves the truthful CoverageFit boundary`, markup.includes('CoverageFit is educational, not a quote or eligibility decision.') && markup.includes('data-cf-next="/assessment/"'));
  check(`${rel}: prefilled text requests an eligibility review`, /professional%20discount%20eligibility%20review/.test(markup));
  check(`${rel}: contains no deterministic eligibility or savings result`, !/You are eligible|Eligibility confirmed|instant eligibility result|guaranteed discount|guaranteed savings/i.test(markup));
}

const receiverAssessment = path.join(receiverRoot, 'assessment/index.html');
check('paired CoverageFit assessment is available', fs.existsSync(receiverAssessment));
const assessment = fs.readFileSync(receiverAssessment, 'utf8');
check('CoverageFit still rejects eligibility conclusions', assessment.replace(/\s+/g, ' ').includes('does not use them to make underwriting, eligibility, valuation, hazard, or coverage conclusions'));
check('CRO-1.6.1 documentation remains packaged', /CoverageFit was regression-tested but not modified/.test(read('SPRINT-408-CRO-1.6.1.md')));

console.log(JSON.stringify({ sprint: '408-CRO-1.6.1', passed: checks.length, failed: 0, checks }, null, 2));
