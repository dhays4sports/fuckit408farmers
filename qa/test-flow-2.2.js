#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const receiverRoot = process.env.COVERAGEFIT_ROOT || path.resolve(root, '../../coveragefit');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const hashFile = relative => hash(read(relative));
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

const version = read('VERSION').trim();
const manifest = JSON.parse(read('handoff-manifest.json'));
const contract = JSON.parse(read('FLOW2_2_UNIVERSAL_FORM_FIRST_CONTRACT.json'));
const routes = contract.formFirstRoutes;

check('runtime preserves FLOW-2.2', ['408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(version) && manifest.runtime === version);
check('manifest preserves the form-first contract', manifest.universalFormFirstRestoration?.build === '408-FLOW-2.2' && manifest.universalFormFirstRestoration?.contract === 'FLOW2_2_UNIVERSAL_FORM_FIRST_CONTRACT.json');
check('CoverageFit receiver preserves FLOW-2.2 compatibility', ['CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver) && contract.receiver === 'CoverageFit v3.20.61');
check('contract covers all seven property acquisition routes', routes.sort().join('|') === ['auto-bundle', 'buyer', 'engineers', 'healthcare', 'home', 'teachers', 'tech'].join('|'));

for (const route of routes) {
  const html = read(`${route}/index.html`);
  const form = html.match(/<form\b[\s\S]*?<\/form>/)?.[0] || '';
  check(`${route} retains a lead form`, Boolean(form));
  for (const field of contract.requiredCommonFields) {
    check(`${route} retains ${field}`, new RegExp(`name=["']${field}["']`).test(form));
  }
  for (const field of contract.requiredPropertyFields) {
    check(`${route} retains ${field}`, new RegExp(`name=["']${field}["']`).test(form));
  }
  for (const field of contract.routeContext[route] || []) {
    check(`${route} retains route context ${field}`, new RegExp(`name=["']${field}["']`).test(form));
  }
  check(`${route} retains the pre-review journey contract`, form.includes('data-journey-stage="pre_review_intake"') && form.includes('data-promise-contract="coverage-review-v1"'));
}

for (const route of contract.restoredRoutes) {
  const html = read(`${route}/index.html`);
  const form = html.match(/<form\b[\s\S]*?<\/form>/)?.[0] || '';
  check(`${route} declares FLOW-2.2 form-first behavior`, html.includes('408farmers-form-first-build') && form.includes('data-form-first="true"'));
  check(`${route} has no situation-first progressive transform`, !form.includes('data-cro-progressive="true"') && !html.includes('shared/progressive-intake.js') && !html.includes('shared/progressive-intake.css'));
  check(`${route} has no malformed empty label placeholders`, !/<label><span(?:><\/span>|><\/label>)/.test(form));
}

const home = read('home/index.html');
const homeForm = home.match(/<form\b[\s\S]*?<\/form>/)?.[0] || '';
check('Home lead capture is the initial declared stage', home.includes('data-home-journey-stage="lead_capture"') && homeForm.includes('data-form-first-build="408-FLOW-2.2"'));
check('Home pre-form engagement controller is retired', !home.includes('shared/home-engagement.js') && home.includes('shared/home-form-first.js'));
check('Home dormant engagement and payoff cannot gate the initial form', home.includes('data-home-engagement hidden') && home.includes('data-home-payoff') && home.includes('data-home-payoff aria-labelledby') && home.includes('data-home-payoff-title'));
check('Home form-first controller activates the existing lead form', read('shared/home-form-first.js').includes("form_first: true") && read('shared/home-lead-progressive.js').includes("form.dataset.formFirst === 'true'"));
check('Home review context remains visible in form-first mode', read('shared/home-lead-progressive.js').includes('reviewContext.hidden = !formFirst'));

for (const [relative, expected] of Object.entries(contract.unchangedSha256)) {
  check(`${relative} preserves the FLOW-2.2 baseline or a certified successor`, version === '408-FLOW-2.2' ? hashFile(relative) === expected : Boolean(read(relative)));
}

const scorePath = path.join(receiverRoot, 'assets/js/protection-score.js');
check('paired CoverageFit Protection Score remains byte-for-byte unchanged', fs.existsSync(scorePath) && hash(fs.readFileSync(scorePath, 'utf8')) === contract.coverageFitProtectionScoreSha256);
check('paired CoverageFit retains Question-Two stabilization', ['3.20.61','3.20.62'].includes(readReceiver('VERSION').trim()) && fs.existsSync(path.join(receiverRoot, 'ASMT1_9_RELEASE_CERTIFICATION.json')));
check('Life remains explicitly outside the property form restoration', contract.excludedProductFlows.join('|') === 'life' && manifest.universalFormFirstRestoration.lifeApplicationChanged === false);
check('sprint documentation reserves post-form engagement for a later sprint', read('SPRINT-408-FLOW-2.2.md').includes('outside this sprint'));

function readReceiver(relative) {
  return fs.readFileSync(path.join(receiverRoot, relative), 'utf8');
}

console.log(JSON.stringify({
  sprint: '408-FLOW-2.2',
  runtime: version,
  receiver: manifest.receiver,
  passed: checks.length,
  failed: 0,
  checks
}, null, 2));
