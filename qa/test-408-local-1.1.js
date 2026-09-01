#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'local', 'index.html');
const cssPath = path.join(root, 'shared', 'local.css');
const workerPath = path.join(root, '_worker.js');
const roadmapPath = path.join(root, '408-LOCAL-ROADMAP.md');
const contractPath = path.join(root, 'LOCAL1_1_FOUNDATION_CONTRACT.json');
const sprintPath = path.join(root, 'SPRINT-408-LOCAL-1.1.md');

for (const required of [htmlPath, cssPath, workerPath, roadmapPath, contractPath, sprintPath]) {
  assert(fs.existsSync(required), `missing required file: ${path.relative(root, required)}`);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const workerSource = fs.readFileSync(workerPath, 'utf8');
const roadmap = fs.readFileSync(roadmapPath, 'utf8');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

const checks = [];
function check(name, condition) {
  checks.push({ name, passed: Boolean(condition) });
  assert(condition, name);
}

check('build fingerprint', html.includes('data-local-build="408-LOCAL-1.1"'));
check('canonical local URL', html.includes('href="https://408farmers.com/local/"'));
check('Local title', html.includes('408FARMERS LOCAL'));
check('primary positioning', html.includes('Good businesses.') && html.includes('Useful local perks.'));
check('no insurance purchase required visible', /No insurance purchase required/i.test(html));
check('no quote required visible', /No quote required/i.test(html));
check('insurance pricing boundary visible', /does not change insurance rates, discounts, coverage, eligibility or underwriting/i.test(html));
check('no consumer form on foundation page', !/<form\b/i.test(html));
check('no CoverageFit launcher on foundation page', !/data-coveragefit-launch/i.test(html));
check('no live merchant claims', html.includes('merchant offers coming next'));
check('Eat & Drink category', html.includes('Eat &amp; Drink'));
check('Home category', /<p class="local-category-label">Home<\/p>/.test(html));
check('Auto category', /<p class="local-category-label">Auto<\/p>/.test(html));
check('merchant pilot contact exists', html.includes('Contact Dylan about Local'));
check('license displayed', html.includes('CA License #4528400'));
check('privacy link exists', html.includes('href="/privacy.html"'));
check('Local CSS loaded', html.includes('../shared/local.css'));
check('Local CSS scoped', css.includes('.local-page') && css.includes('.local-hero') && css.includes('.local-boundary-card'));
check('mobile breakpoint', css.includes('@media(max-width:720px)'));
check('reduced-motion handling', css.includes('@media(prefers-reduced-motion:reduce)'));
check('worker canonical Local directory', workerSource.includes("'/local'"));
check('roadmap contains all MVP sprints', Array.from({length: 10}, (_, i) => `408-LOCAL-1.${i+1}`).every(id => roadmap.includes(id)));
check('roadmap contains expansion generations', ['408-LOCAL-2.1','408-LOCAL-3.1','408-LOCAL-4.1'].every(id => roadmap.includes(id)));
check('contract route', contract.route === '/local/');
check('contract no purchase gate', contract.insuranceBoundary.insurancePurchaseRequired === false);
check('contract no quote gate', contract.insuranceBoundary.insuranceQuoteRequired === false);
check('contract next sprint', contract.nextSprint === '408-LOCAL-1.2');

// Execute the Worker source in a lightweight Pages binding simulation.
let source = workerSource.replace('export default {', 'globalThis.__worker = {');
const runner = new Function(
  'TextEncoder','TextDecoder','URL','Request','Response','Headers','crypto','btoa','atob',
  `${source}\nreturn globalThis.__worker;`
);
const worker = runner(
  TextEncoder, TextDecoder, URL, Request, Response, Headers, globalThis.crypto,
  globalThis.btoa || ((value) => Buffer.from(value, 'binary').toString('base64')),
  globalThis.atob || ((value) => Buffer.from(value, 'base64').toString('binary'))
);

(async () => {
  const seen = [];
  const env = { ASSETS: { fetch: async (request) => {
    const url = new URL(request.url);
    seen.push(url.pathname);
    return new Response(`asset:${url.pathname}`, { status: 200 });
  } } };

  let response = await worker.fetch(new Request('https://408farmers.com/local'), env);
  check('worker redirects /local once', response.status === 308 && response.headers.get('location') === 'https://408farmers.com/local/');
  check('redirect does not fetch asset', seen.length === 0);

  response = await worker.fetch(new Request('https://408farmers.com/local/'), env);
  check('worker serves /local/ directly', response.status === 200 && seen.at(-1) === '/local/');

  const result = {
    sprint: '408-LOCAL-1.1',
    total: checks.length,
    passed: checks.filter(c => c.passed).length,
    failed: checks.filter(c => !c.passed).length,
    checks
  };
  fs.writeFileSync(path.join(root, 'LOCAL1_1_QA.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`408-LOCAL-1.1 QA: ${result.passed}/${result.total} passed`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
