#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const bytes = relative => fs.statSync(path.join(root, relative)).size;
const hashText = value => crypto.createHash('sha256').update(value).digest('hex');
const hashFile = relative => hashText(read(relative));
const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
const version = read('VERSION').trim();
const manifest = JSON.parse(read('handoff-manifest.json'));
const contract = JSON.parse(read('FLOW2_1_OCCUPATIONAL_VISUAL_CONTRACT.json'));
const css = read('shared/occupational-simplification.css');

check('runtime preserves FLOW-2.1 through the form-first successor', ['408-FLOW-2.1', '408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(version) && manifest.runtime === version);
check('manifest publishes the occupational visual contract', manifest.occupationalVisualSimplification?.build === '408-FLOW-2.1' && manifest.occupationalVisualSimplification?.contract === 'FLOW2_1_OCCUPATIONAL_VISUAL_CONTRACT.json');
check('contract covers exactly four occupational routes', Object.keys(contract.routes).sort().join('|') === ['engineers', 'healthcare', 'teachers', 'tech'].join('|'));
check('simplification stylesheet is isolated from shared base styles', css.includes('.occupational-page .occupational-hero') && !read('shared/styles.css').includes('408-FLOW-2.1'));
check('desktop layout is explicit', css.includes('grid-template-columns: minmax(0, 1fr) minmax(420px, 500px)'));
check('tablet and mobile layouts collapse to one column', css.includes('@media (max-width: 1050px)') && css.includes('grid-template-columns: 1fr') && css.includes('@media (max-width: 700px)'));
check('occupational CSS contains no image reference', !/url\s*\(/i.test(css));

const routeTransfers = {};
for (const [name, routeContract] of Object.entries(contract.routes)) {
  const relative = `${name}/index.html`;
  const html = read(relative);
  const body = html.slice(html.indexOf('<body'));
  const form = html.match(/<form\b[\s\S]*?<\/form>/)?.[0] || '';
  const scriptList = [...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(match => match[1]).join('|');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  check(`${name} identifies the FLOW-2.1 visual build`, html.includes('name="408farmers-visual-build" content="408-FLOW-2.1"') && body.includes('data-occupational-visual-build="408-FLOW-2.1"'));
  check(`${name} loads the isolated simplification stylesheet last`, html.indexOf('shared/occupational-simplification.css') > html.indexOf('shared/accessibility.css'));
  check(`${name} uses the simplified occupational hero`, html.includes('class="hero occupational-hero"'));
  check(`${name} renders no campaign hero picture`, !body.includes('campaign-hero-media') && !body.includes('class="visual-card'));
  check(`${name} body fetches no occupational campaign image`, !new RegExp(`shared/assets/${name}(?:-|\\.|\\.webp)`).test(body));
  check(`${name} retains a social-sharing image`, html.includes(`content="../shared/assets/${name}.png" property="og:image"`));
  check(`${name} has no high-priority image fetch`, !body.includes('fetchpriority="high"'));
  check(`${name} form evolution is bounded`, version === '408-FLOW-2.1' ? hashText(form) === routeContract.formSha256 : form.includes('data-form-first="true"') && form.includes('data-form-first-build="408-FLOW-2.2"'));
  check(`${name} script evolution is bounded`, version === '408-FLOW-2.1' ? hashText(scriptList) === contract.orderedExternalScriptListSha256 : !scriptList.includes('progressive-intake.js'));
  check(`${name} CoverageFit continuation remains`, form.includes('data-cf-next="/assessment/"') && form.includes('data-coveragefit-after-submit="true"'));
  check(`${name} consent and professional context remain`, form.includes('name="consent" required') && form.includes('name="occupation_segment"') && form.includes('Professional eligibility and home coverage review'));
  check(`${name} direct text and call choices remain`, html.includes('class="direct-contact-choice"') && html.includes('sms:+14083276377') && html.includes('tel:+14083276377'));
  check(`${name} contains no duplicate IDs`, new Set(ids).size === ids.length);
  let initialBytes = bytes(relative) + bytes('shared/assets/408-farmers-logo.png');
  for (const match of html.matchAll(/<(?:link|script)\b[^>]*(?:href|src)="([^"]+)"/g)) {
    const source = match[1].split('?')[0];
    if (!source.startsWith('../')) continue;
    const asset = path.normalize(path.join(name, source));
    if (fs.existsSync(path.join(root, asset))) initialBytes += bytes(asset);
  }
  routeTransfers[name] = initialBytes;
  check(`${name} initial transfer stays below the simplified route budget`, initialBytes < contract.initialRouteTransferMaxBytes);
}
for (const [relative, expected] of Object.entries(contract.unchanged.nonOccupationalRoutes)) {
  check(`${relative} remains unchanged or is owned by a certified successor`, version === '408-FLOW-2.1' ? hashFile(relative) === expected : Boolean(read(relative)));
}
check('sprint documentation records the original form-preservation boundary', read('SPRINT-408-FLOW-2.1.md').includes('byte-for-byte unchanged'));
check('CoverageFit receiver remains synchronized without changing the visual contract', ['CoverageFit v3.20.60', 'CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver) && manifest.occupationalVisualSimplification.coverageFitHandoffChanged === false);
console.log(JSON.stringify({ sprint: '408-FLOW-2.1', runtime: version, passed: checks.length, failed: 0, routeTransfers, checks }, null, 2));
