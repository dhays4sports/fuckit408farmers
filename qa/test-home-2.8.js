#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
const continuity = require(path.join(root, 'shared/home-continuity.js'));
const journey = require(path.join(root, 'shared/home-journey-contract.js'));
const manifest = JSON.parse(read('handoff-manifest.json'));
const contract = JSON.parse(read('HOME2_8_CONTINUITY_BRANCH_RECOVERY_CONTRACT.json'));
const home = read('home/index.html');
const submit = read('shared/script.js');
const score = fs.readFileSync(path.resolve(root, '../../receiver/coveragefit/assets/js/protection-score.js'), 'utf8');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

check('release pair preserves HOME-2.8 behavior in the current pair', ['408-HOME-2.9', '408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()) && continuity.BUILD === '408-HOME-2.9' && journey.BUILD === '408-HOME-2.9' && ['CoverageFit v3.20.60', 'CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver));
check('checkpoint is tab scoped for six hours', continuity.TTL_MS === 21600000 && contract.preLeadContinuity.storage === 'sessionStorage');

const store = new MemoryStorage();
const now = Date.parse('2026-08-13T03:00:00.000Z');
const saved = continuity.write({
  stage: 'lead_capture', engagementStep: 3, leadStep: 2,
  homeReviewGoal: 'coverage_fit', housingContext: 'buyer', reviewTiming: 'shopping_now',
  campaignId: 'home_flyer_95118_rate', campaignZip: '95118', campaignVariant: 'rate',
  firstName: 'Should not persist', email: 'private@example.com', propertyAddress: '123 Main St'
}, store, now);
check('valid bounded checkpoint restores its stage and campaign', saved.stage === 'lead_capture' && saved.branch === 'buyer' && saved.campaignId === 'home_flyer_95118_rate');
const serialized = store.getItem(continuity.STORAGE_KEY);
check('pre-lead checkpoint excludes identity, contact, property, consent, and free form', !/Should not persist|private@example|123 Main|firstName|email|propertyAddress|consent|free.form/i.test(serialized));
check('expired checkpoint is rejected and removed', continuity.read(store, now + continuity.TTL_MS + 1) === null && store.getItem(continuity.STORAGE_KEY) === null);
check('invalid semantic and campaign values cannot enter checkpoint', continuity.normalize({ stage: 'engagement', updatedAt: new Date(now).toISOString(), homeReviewGoal: 'free text', campaignZip: '9511', campaignVariant: 'savings' }, now).homeReviewGoal === '' && continuity.normalize({ stage: 'engagement', updatedAt: new Date(now).toISOString(), campaignZip: '9511', campaignVariant: 'savings' }, now).campaignId === '');

check('owner occupied branch stays in CoverageFit', continuity.resolveBranch('owner_occupied').destinationType === 'coveragefit' && continuity.resolveBranch('owner_occupied').propertyRequired);
check('landlord branch stays in CoverageFit with property required', continuity.resolveBranch('landlord').destination === '/assessment/' && continuity.resolveBranch('landlord').propertyRequired);
check('buyer branch stays in CoverageFit with property required', continuity.resolveBranch('buyer').destination === '/assessment/' && continuity.resolveBranch('buyer').propertyRequired);
check('renter branch avoids homeowner assessment and address request', continuity.resolveBranch('renter').destinationType === 'renters' && continuity.resolveBranch('renter').propertyRequired === false);

check('Home page includes visible recovery controls and ordered continuity asset', home.includes('data-home-recovery-continue') && home.includes('data-home-recovery-start-over') && home.indexOf('home-continuity.js') < Math.max(home.indexOf('home-engagement.js'), home.indexOf('home-form-first.js')));
check('recovery relaunch never automatically replays Formspree', submit.includes("408farmers:home-handoff-retry") && !/home-handoff-retry[\s\S]{0,2500}fetch\(endpoint/.test(submit));
check('start over clears checkpoint, prospect, and pending lead', submit.includes('ProspectProfileBuilder?.clear?.()') && submit.includes('clearPendingLead()') && continuity.clear);
check('recovery and branch telemetry remain bounded', ['JOURNEY_RESUMED', 'JOURNEY_RESTARTED', 'JOURNEY_EXPIRED', 'BRANCH_RESOLVED', 'HANDOFF_RECOVERY_VIEWED', 'HANDOFF_RECOVERY_CONTINUED'].every(name => journey.EVENTS[name]));
check('campaign matching and same canonical Home journey remain preserved', manifest.homeCampaignMatching.sameJourney === '/home/' && contract.coverageFit.assessmentDraftDays === 7);
check('two leads, assessment, recommendations, and score remain unchanged', contract.leadPointsPreserved === 2 && !contract.assessmentQuestionsChanged && !contract.recommendationsChanged && !contract.protectionScoreChanged && !/HomeJourneyContinuity|home_handoff_recovery|housingContext/.test(score));

console.log(`408-HOME-2.8 QA: ${checks.length}/${checks.length} passed`);
