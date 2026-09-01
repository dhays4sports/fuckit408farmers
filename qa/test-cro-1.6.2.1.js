#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const receiverRoot = process.env.COVERAGEFIT_ROOT || path.resolve(root, '..', 'coveragefit');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };

check('sender preserves CRO-1.6.2.1 after later public releases', ['408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
check('homepage leads with a concrete review payoff', read('index.html').includes('See what still fits, what may deserve a closer look'));
check('buyer route addresses the closing motivation', read('buyer/index.html').includes('last-minute closing issue') && read('buyer/index.html').includes('Continue My New-Home Review'));

for (const rel of ['healthcare/index.html', 'teachers/index.html', 'tech/index.html', 'engineers/index.html']) {
  const markup = read(rel);
  check(`${rel}: balances protection and professional savings`, markup.includes('build a Protection Snapshot') && markup.includes('what looks strong') && markup.includes('professional discounts may be available'));
  check(`${rel}: preserves conditional eligibility language`, markup.includes('may qualify') && !/you qualify|guaranteed discount|eligibility confirmed/i.test(markup));
}

const auto = read('auto-bundle/index.html');
const runtime = read('shared/script.js');
check('bundle form declares the housing branch', auto.includes('data-cf-branch-field="housing_context"') && auto.includes('data-cf-renter-destination="/contact/?intent=renters'));
check('homeowners retain CoverageFit Home continuation', auto.includes('data-cf-next="/assessment/"') && auto.includes('Homeowners continue into the five-minute CoverageFit Home review'));
check('renters bypass the homeowner assessment after lead submission', (runtime.includes('renterBranchDestination') || runtime.includes('branchPlan')) && runtime.includes("event: 'renters_direct_review_handoff'") && auto.includes('renters continue directly to Dylan'));
check('lead delivery remains non-gating', runtime.includes('LEAD_SUBMISSION_GRACE_MS = 900') && runtime.includes('Promise.race') && runtime.includes("resolve('pending')"));

const contact = require(path.join(root, 'shared/contact-choice.js'));
const renterChoice = contact.resolve('?intent=renters');
check('renters receive a specific direct-contact continuation', renterChoice.intent === 'renters' && /renters protection/.test(renterChoice.context.intro));

const manifest = JSON.parse(read('handoff-manifest.json'));
check('manifest records two lead points and no hard gate', manifest.intentPayoffAlignment?.leadPointsPreserved === 2 && manifest.intentPayoffAlignment?.formspreeHardGateAdded === false);
check('paired CoverageFit release is available', fs.existsSync(path.join(receiverRoot, 'VERSION')) && ['3.20.53', '3.20.54','3.20.55','3.20.56','3.20.57','3.20.58','3.20.59','3.20.60','3.20.61','3.20.62'].includes(fs.readFileSync(path.join(receiverRoot, 'VERSION'), 'utf8').trim()));
check('paired projects publish one contract', read('professional-intent-contract.json') === fs.readFileSync(path.join(receiverRoot, 'professional-intent-contract.json'), 'utf8'));

console.log(JSON.stringify({ sprint: '408-CRO-1.6.2.1', passed: checks.length, failed: 0, checks }, null, 2));
