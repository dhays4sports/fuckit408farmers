#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const senderRoot = path.resolve(__dirname, '..');
const receiverRoot = path.resolve(process.env.COVERAGEFIT_ROOT || path.join(senderRoot, '..', 'coveragefit'));
function read(root, rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function versionAtLeast(value, minimum) {
  const parsed = String(value).trim().split('.').map(Number);
  const floor = String(minimum).split('.').map(Number);
  if (parsed.length !== 3 || floor.length !== 3 || !parsed.every(Number.isFinite) || !floor.every(Number.isFinite)) return false;
  for (let index = 0; index < 3; index += 1) {
    if (parsed[index] !== floor[index]) return parsed[index] > floor[index];
  }
  return true;
}
assert(fs.existsSync(path.join(receiverRoot, 'VERSION')), 'Set COVERAGEFIT_ROOT to the CoverageFit NP-1.4 or later project root.');
const token = `ref_${'B'.repeat(16)}`;
const sender = require(path.join(senderRoot, 'shared/referral-bridge.js'));
const receiverShare = require(path.join(receiverRoot, 'assets/js/post-submission-share.js'));
const route = sender.readRoute({ pathname: `/neighbor/r/${token}`, search: '?share=native' });
const destination = new URL(sender.buildDestination(route));
assert(versionAtLeast(read(receiverRoot, 'VERSION'), '3.20.17'));
assert(['NP-1.4','NP-1.5'].includes(receiverShare.BUILD));
assert.equal(receiverShare.tokenFromUrl(`https://408farmers.com/neighbor/r/${token}`), token);
assert.equal(destination.origin + destination.pathname, 'https://coveragefit.com/home/');
assert.equal(destination.searchParams.get('rid'), token);
assert.equal(destination.searchParams.get('ref'), 'neighbor');
assert(read(receiverRoot, 'assets/js/referred-homeowner-welcome.js').includes("const TOKEN_PARAMETER = 'rid'"));
console.log('PASS NP-1.4 cross-repository branded referral bridge contract');
