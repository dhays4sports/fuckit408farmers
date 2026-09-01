#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

const version = read('VERSION').trim();
const home = read('home/index.html');
const launch = read('shared/coveragefit-launch.js');
const contract = JSON.parse(read('HOME2_6_SENDER_CONTRACT.json'));
const manifest = JSON.parse(read('handoff-manifest.json'));
const journey = require(path.join(root, 'shared/home-journey-contract.js'));

check('sender preserves HOME-2.6 intent reception', ['408-HOME-2.6', '408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(version) && ['408-HOME-2.6', '408-HOME-2.7','408-HOME-2.8','408-HOME-2.9'].includes(journey.BUILD));
check('Home page fingerprints synchronize', home.includes(`data-sender-build="${journey.BUILD}"`) && home.includes(`home-confirmation.js?v=${journey.BUILD}`));
check('all three intent fields retain bounded sender values', Object.keys(contract.fields).every(field => contract.fields[field].length === 4));
check('launcher forwards all three intent fields', ['home_review_goal', 'housing_context', 'review_timing'].every(field => launch.includes(field)));
check('manifest publishes paired intent reception', manifest.runtime === version && ['CoverageFit v3.20.57', 'CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver) && manifest.homeIntentReception?.build === '408-HOME-2.6');
check('automatic continuation and one-time property confirmation stay contracted', contract.sequence.includes('visible lead confirmation') && contract.sequence.includes('one-time property confirmation'));
check('contact, consent, and two lead points remain preserved', contract.privacy.contactAndConsentStoredPrivately && contract.leadPointsPreserved === 2);
check('intent is explicitly excluded from Protection Score', contract.scoring.intentFieldsAffectProtectionScore === false && manifest.homeIntentReception.protectionScoreChanged === false);

console.log(`408-HOME-2.6 QA: ${checks.length}/${checks.length} passed`);
