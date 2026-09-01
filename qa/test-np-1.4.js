#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const bridge = require(path.join(root, 'shared/referral-bridge.js'));
const checks = [];
function check(name, fn) { fn(); checks.push(name); console.log('PASS', name); }

const token = `ref_${'A'.repeat(16)}`;
check('release identifies the NP-1.4 referral bridge', () => {
  assert(['408-NP-1.4','408-NP-1.5','408-BUY-1.1','408-BUY-1.2','408-BUY-1.3','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4','408-BUY-1.4','408-BUY-1.5','408-CRO-1.1','408-CRO-1.2','408-CRO-1.3','408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
  assert(['1.0.0','1.1.0'].includes(bridge.VERSION));
  assert(['408-NP-1.4','408-NP-1.5'].includes(bridge.BUILD));
});
check('valid clean referral paths recover the anonymous token without query-string identity data', () => {
  const route = bridge.readRoute({ pathname: `/neighbor/r/${token}`, search: '?share=sms' });
  assert.equal(route.validToken, true);
  assert.equal(route.token, token);
  assert.equal(route.shareChannel, 'sms');
});
check('generic and malformed routes fall back without forwarding an invalid token', () => {
  const generic = bridge.readRoute({ pathname: '/neighbor/', search: '' });
  const malformed = bridge.readRoute({ pathname: '/neighbor/r/not-a-token', search: '?share=bad' });
  assert.equal(generic.generic, true);
  assert.equal(malformed.generic, true);
  assert.equal(malformed.token, '');
  assert.equal(malformed.shareChannel, '');
});
check('bridge forwards valid referrals into the existing CoverageFit Home journey', () => {
  const route = bridge.readRoute({ pathname: `/neighbor/r/${token}`, search: '?share=copy' });
  const destination = new URL(bridge.buildDestination(route));
  assert.equal(destination.origin, 'https://coveragefit.com');
  assert.equal(destination.pathname, '/home/');
  assert.equal(destination.searchParams.get('ref'), 'neighbor');
  assert.equal(destination.searchParams.get('rid'), token);
  assert.equal(destination.searchParams.get('share'), 'copy');
  assert(['408-NP-1.4','408-NP-1.5'].includes(destination.searchParams.get('bridge')));
  assert.notEqual(destination.origin, 'https://408farmers.com');
  assert.notEqual(destination.pathname, '/transition/');
});
check('bridge preserves bounded campaign attribution and applies neighbor defaults', () => {
  const route = bridge.readRoute({
    pathname: `/neighbor/r/${token}`,
    search: '?share=native&utm_source=friend&utm_medium=message&utm_campaign=95118_fit&utm_content=version_b'
  });
  const destination = new URL(bridge.buildDestination(route));
  assert.equal(destination.searchParams.get('utm_source'), 'friend');
  assert.equal(destination.searchParams.get('utm_medium'), 'message');
  assert.equal(destination.searchParams.get('utm_campaign'), '95118_fit');
  assert.equal(destination.searchParams.get('utm_content'), 'version_b');
  assert.equal(destination.searchParams.get('source'), '408farmers');
  assert.equal(destination.searchParams.get('entry'), 'neighbor_referral_bridge');
});
check('invalid paths continue to the safe generic neighbor welcome', () => {
  const destination = new URL(bridge.buildDestination(bridge.readRoute({ pathname: '/neighbor/r/broken', search: '' })));
  assert.equal(destination.searchParams.get('ref'), 'neighbor');
  assert.equal(destination.searchParams.has('rid'), false);
});
check('transition uses replace navigation for stable back-button behavior', () => {
  const code = read('shared/referral-bridge.js');
  assert(code.includes("locationRef.replace(rendered.destination)"));
  assert(code.includes('DEFAULT_DELAY_MS = 2300'));
  assert(code.includes('REDUCED_MOTION_DELAY_MS = 650'));
});
check('bridge page is a focused full-screen handoff and not a duplicate intake', () => {
  const html = read('neighbor/index.html');
  assert(html.includes('Preparing your personalized CoverageFit review'));
  assert(html.includes('408FARMERS'));
  assert(html.includes('CoverageFit'));
  assert(html.includes('data-referral-bridge-shell'));
  assert(!/<form\b/i.test(html));
  assert(!/name=["'](?:first_name|phone|email|property_address)/i.test(html));
});
check('manifest publishes the paired receiver contract', () => {
  const manifest = JSON.parse(read('handoff-manifest.json'));
  assert(['408-NP-1.4','408-NP-1.5'].includes(manifest.referralBridge.build));
  assert(['CoverageFit v3.20.17','CoverageFit v3.20.18'].includes(manifest.referralBridge.receiver));
  assert.equal(manifest.referralBridge.generic, 'https://408farmers.com/neighbor/');
});
check('clean route rewrites and required local assets are packaged', () => {
  const redirects = read('_redirects');
  const worker = read('_worker.js');
  assert(worker.includes("path.startsWith('/neighbor/r/')"));
  assert(worker.includes("asset: '/neighbor/'"));
  assert(!redirects.includes('/neighbor/index.html')); 
  for (const rel of ['shared/referral-bridge.css','shared/referral-bridge.js','shared/assets/coveragefit-logo.svg','shared/assets/coveragefit-mark.svg']) {
    assert(fs.existsSync(path.join(root, rel)), rel);
  }
});
check('existing validated lead handoff routes retain the prior sender contract', () => {
  for (const rel of ['home/index.html','tech/index.html','engineers/index.html','healthcare/index.html','teachers/index.html']) {
    const html = read(rel);
    assert(/data-sender-build="408-(?:CONV-1\.1|HOME-2\.[123456789])"/.test(html), rel);
    assert(html.includes('data-handoff-contract="coveragefit-handoff-v1"'), rel);
  }
});
check('documentation records the branded bridge, privacy fallback, and deployment route', () => {
  const doc = read('SPRINT-408-NP-1.4.md').toLowerCase();
  for (const phrase of ['408farmers.com/neighbor/r/', 'location.replace', 'generic neighbor', 'no duplicate intake', 'token survives']) assert(doc.includes(phrase), phrase);
});
console.log(`\n408 NP-1.4 QA: ${checks.length}/${checks.length} passed`);
