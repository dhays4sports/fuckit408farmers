#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const receiverRoot = process.env.COVERAGEFIT_ROOT || path.resolve(root, '..', 'coveragefit');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const manifest = JSON.parse(read('handoff-manifest.json'));
const contract = JSON.parse(read('promise-journey-contract.json'));
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

const routeFiles = {
  '/': 'index.html',
  '/home/': 'home/index.html',
  '/auto-bundle/': 'auto-bundle/index.html',
  '/healthcare/': 'healthcare/index.html',
  '/teachers/': 'teachers/index.html',
  '/tech/': 'tech/index.html',
  '/engineers/': 'engineers/index.html',
  '/buyer/': 'buyer/index.html',
  '/contact/': 'contact/index.html',
  '/neighbor/': 'neighbor/index.html',
  '/score/': 'score/index.html'
};
const formRoutes = ['home/index.html', 'auto-bundle/index.html', 'healthcare/index.html', 'teachers/index.html', 'tech/index.html', 'engineers/index.html', 'buyer/index.html'];
const professionalRoutes = ['healthcare/index.html', 'teachers/index.html', 'tech/index.html', 'engineers/index.html'];
const fallbackRoutes = ['home/thank-you.html', 'auto-bundle/thank-you.html', 'healthcare/thank-you.html', 'teachers/thank-you.html', 'tech/thank-you.html', 'engineers/thank-you.html', 'buyer/thank-you.html'];

check('runtime advances to promise and journey consistency', ['408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
check('promise contract is packaged and versioned', exists('promise-journey-contract.json') && ['408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1'].includes(contract.build) && contract.contract === 'coverage-review-v1');
check('manifest publishes the promise contract', ['408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(manifest.runtime) && ['408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1'].includes(manifest.promiseConsistency?.build) && manifest.promiseConsistency?.contract === 'coverage-review-v1');
check('contract covers every acquisition route', JSON.stringify(contract.coveredRoutes) === JSON.stringify(Object.keys(routeFiles)));
check('contract retains the truthful CoverageFit boundary', ['CoverageFit v3.20.51','CoverageFit v3.20.52','CoverageFit v3.20.53','CoverageFit v3.20.54','CoverageFit v3.20.55','CoverageFit v3.20.56','CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(contract.receiver?.release) && typeof contract.receiver?.changed === 'boolean' && contract.receiver?.output === 'Protection Snapshot');

const allRouteMarkup = Object.values(routeFiles).map(read).join('\n');
for (const promise of contract.prohibitedPromises) {
  check(`public acquisition copy removes prohibited promise: ${promise}`, !allRouteMarkup.toLowerCase().includes(promise.toLowerCase()));
}

for (const [route, rel] of Object.entries(routeFiles)) {
  const markup = read(rel);
  check(`${route}: publishes the shared promise contract`, markup.includes('data-promise-contract="coverage-review-v1"'));
  check(`${route}: retains a single primary page heading`, (markup.match(/<h1\b/gi) || []).length === 1);
}

for (const rel of formRoutes) {
  const markup = read(rel);
  check(`${rel}: form identifies pre-review intake stage`, /<form\b[^>]*data-journey-stage="pre_review_intake"[^>]*data-promise-contract="coverage-review-v1"|<form\b[^>]*data-promise-contract="coverage-review-v1"[^>]*data-journey-stage="pre_review_intake"/.test(markup));
  check(`${rel}: zero-repeat CoverageFit continuation is unchanged`, markup.includes('data-coveragefit-after-submit="true"') && markup.includes('data-cf-next="/assessment/"'));
  check(`${rel}: consent language remains explicit`, markup.includes('Consent is not a condition of purchase'));
}

for (const rel of professionalRoutes) {
  const markup = read(rel);
  check(`${rel}: starts a review instead of promising eligibility`, ['Start My Professional Coverage Review', 'Review My Professional Discount Eligibility', 'See Which Professional Discounts May Apply'].some(label => markup.includes(label)) && !/Check My Eligibility|Check your .*eligibility/i.test(markup));
  check(`${rel}: explains discount verification`, markup.includes('Discount availability is verified during quoting and underwriting.') || markup.includes('Dylan verifies availability during quoting and underwriting.'));
  check(`${rel}: distinguishes intake timing`, markup.includes('About one minute to begin'));
}

for (const rel of fallbackRoutes) {
  const markup = read(rel);
  check(`${rel}: identifies the local fallback`, markup.includes('local fallback') && markup.includes('guided CoverageFit continuation'));
  check(`${rel}: avoids response-time and automatic-option promises`, !/reach out shortly|follow up with you shortly|prepare personalized Farmers coverage options|prepares relevant Farmers/i.test(markup));
}

const home = read('home/index.html');
check('Home title and steps describe the real journey', home.includes('<title>Home Coverage Review | 408-FARMERS</title>') && home.includes('CoverageFit builds your Snapshot') && home.includes('Review it with Dylan'));
check('Home does not label the pre-intake as the five-minute assessment', !home.includes('Start My 5-Minute Coverage Review'));

const auto = read('auto-bundle/index.html');
check('Auto Bundle avoids an unverified savings promise', auto.includes('Auto + renters coverage review') && auto.includes('Available discounts vary') && !auto.includes('Fast follow-up'));

const buyer = read('buyer/index.html');
check('Buyer sequence puts CoverageFit before producer options', buyer.includes('CoverageFit will organize the next questions') && buyer.indexOf('Continue the guided review') < buyer.indexOf('Review options with Dylan'));

const score = read('score/index.html');
check('Score connects its educational Snapshot to the producer conversation', score.includes('Use the completed Snapshot to focus a conversation with Dylan') && score.includes('which areas of your protection may deserve a closer look'));

const neighbor = read('neighbor/index.html');
check('Neighbor bridge describes an educational review without automatic producer evaluation', neighbor.includes('educational home Protection Snapshot') && neighbor.includes('completed Snapshot') && !neighbor.includes('personally evaluated by Dylan'));

const progressive = read('shared/progressive-intake.js');
check('progressive controller advances and announces the canonical handoff', ["var BUILD = '408-CRO-1.6'", "var BUILD = '408-CRO-1.6.1'", "var BUILD = '408-CRO-1.6.2'", "var BUILD = '408-CRO-1.6.2.1'", "var BUILD = '408-FLOW-1.5'"].some(build => progressive.includes(build)) && progressive.includes('Protection Snapshot') && progressive.includes('what may deserve a closer look'));

check('CRO-1.5 accessibility contract remains intact', manifest.accessibilityAndResponsive?.build === '408-CRO-1.5' && exists('shared/accessibility.css') && exists('shared/accessibility.js'));
check('CRO-1.4 intake contract remains intact', manifest.lowFrictionIntake?.build === '408-CRO-1.4' && manifest.lowFrictionIntake?.propertyAddressCollection === '408farmers_step_2');
check('lead delivery and zero-repeat handoff remain intact', read('shared/script.js').includes('LEAD_SUBMISSION_GRACE_MS = 900') && manifest.coverageFit?.zeroRepeat === true && manifest.handoff?.next === '/assessment/');

check('paired CoverageFit pages are available', fs.existsSync(path.join(receiverRoot, 'home/index.html')) && fs.existsSync(path.join(receiverRoot, 'assessment/index.html')));
const receiverHome = fs.readFileSync(path.join(receiverRoot, 'home/index.html'), 'utf8');
const receiverAssessment = fs.readFileSync(path.join(receiverRoot, 'assessment/index.html'), 'utf8');
check('CoverageFit starts with review rather than quote', receiverHome.includes('You’re not requesting a quote yet') && receiverHome.includes('Start My Home Coverage Review'));
check('CoverageFit produces the promised educational Snapshot', receiverAssessment.includes("Let's build your Protection Snapshot") && receiverAssessment.includes('Most people finish in about five minutes') && receiverAssessment.replace(/\s+/g, ' ').includes('CoverageFit is not a quote, insurance advice, or a coverage determination'));
check('CoverageFit rejects eligibility conclusions', receiverAssessment.replace(/\s+/g, ' ').includes('does not use them to make underwriting, eligibility, valuation, hazard, or coverage conclusions'));
check('sprint documentation records the unchanged receiver', exists('SPRINT-408-CRO-1.6.md') && /CoverageFit was inspected and regression-tested but not modified/.test(read('SPRINT-408-CRO-1.6.md')));

console.log(JSON.stringify({ sprint: '408-CRO-1.6', passed: checks.length, failed: 0, checks }, null, 2));
