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
const script = read('shared/script.js');
const baseline = read('shared/home-baseline.js');
const profile = read('shared/prospect-profile.js');
const launcher = read('shared/coveragefit-launch.js');
const manifest = JSON.parse(read('handoff-manifest.json'));
const contractJson = JSON.parse(read('HOME2_1_JOURNEY_CONTRACT.json'));
const contract = require(path.join(root, 'shared/home-journey-contract.js'));

check('release preserves the HOME-2.1 foundation', ['408-HOME-2.1', '408-HOME-2.2', '408-HOME-2.3', '408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(version));
check('HOME-2.1 machine-readable contract remains immutable', contractJson.build === '408-HOME-2.1' && contractJson.version === '1.0' && contractJson.contract === contract.CONTRACT);
check('contract preserves eight stages and at least ten events', Object.keys(contract.STAGES).length === 8 && Object.keys(contract.EVENTS).length >= 10);
check('semantic fields are bounded', Object.keys(contract.SEMANTIC_FIELDS).join(',') === 'home_review_goal,housing_context,review_timing');
check('buyer takes derivation precedence', contract.deriveReviewContext({ home_review_goal: 'home_auto_bundle', housing_context: 'buyer', review_timing: 'renewal_60' }) === 'Buying a home');
check('renewal precedes bundle derivation', contract.deriveReviewContext({ home_review_goal: 'home_auto_bundle', housing_context: 'owner_occupied', review_timing: 'renewal_60' }) === 'Current policy renewal');
check('invalid semantic values are discarded', contract.semanticContext({ home_review_goal: 'free form data' }).homeReviewGoal === '');
check('existing review context is preserved when semantic context is absent', contract.deriveReviewContext({}, 'Premium increased') === 'Premium increased');

for (const name of ['home_review_goal', 'housing_context', 'review_timing']) {
  check(`Home form reserves ${name}`, home.includes(`name="${name}" type="hidden"`));
}
check('Home form declares the journey contract without replacing FLOW-1.5 handoff', home.includes('data-home-journey="true"') && home.includes('data-handoff-contract="coveragefit-handoff-v1"') && home.includes('data-cf-next="/assessment/"'));
check('Home sender fingerprint advances independently', /data-sender-build="408-HOME-2\.[123456789]"/.test(home));
check('journey assets load before the shared submit controller', home.indexOf('home-journey-contract.js') < home.indexOf('home-baseline.js') && home.indexOf('home-baseline.js') < home.indexOf('shared/script.js'));
check('canonical profile carries reserved semantic fields', ['homeReviewGoal', 'housingContext', 'reviewTiming'].every(token => profile.includes(token)));
check('CoverageFit launcher allowlists reserved semantic parameters', ['home_review_goal', 'housing_context', 'review_timing'].every(token => launcher.includes(token)));
check('submit controller emits attempt, status, and launch events', ['LEAD_SUBMISSION_ATTEMPTED', 'LEAD_SUBMISSION_CONFIRMED', 'LEAD_SUBMISSION_PENDING', 'LEAD_SUBMISSION_UNCONFIRMED', 'COVERAGEFIT_LAUNCHED'].every(token => script.includes(token)));
check('baseline controller excludes homeowner identity fields', !['first_name', 'last_name', 'phone', 'email', 'property_address'].some(token => baseline.includes(token)));
check('baseline controller allowlists event properties', baseline.includes('allowedExtra') && baseline.includes('semantic_context_set') && baseline.includes('campaign_zip'));
check('lead submission remains non-blocking', script.includes('keepalive:true') && script.includes('Promise.race') && script.includes('LEAD_SUBMISSION_GRACE_MS'));
check('manifest publishes synchronized foundation', ['408-HOME-2.1', '408-HOME-2.2', '408-HOME-2.3', '408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(manifest.runtime) && manifest.homeJourneyFoundation?.contract === 'home-review-journey-v1' && ['CoverageFit v3.20.56', 'CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver));
check('foundation explicitly leaves visible journey, assessment, and scoring unchanged', contractJson.scope.userVisibleJourneyChanged === false && contractJson.scope.assessmentQuestionsChanged === false && contractJson.scope.protectionScoreChanged === false);

console.log(`408-HOME-2.1 QA: ${checks.length}/${checks.length} passed`);
