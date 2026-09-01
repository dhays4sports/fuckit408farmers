'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const senderRoot = path.resolve(__dirname, '..');
const receiverRoot = process.env.COVERAGEFIT_ROOT ? path.resolve(process.env.COVERAGEFIT_ROOT) : null;
if (!receiverRoot) throw new Error('Set COVERAGEFIT_ROOT to the coordinated CoverageFit repository.');
const read = (root, relative) => fs.readFileSync(path.join(root, relative), 'utf8');
let assertions = 0;
const check = (condition, message) => { assert.ok(condition, message); assertions += 1; };

const senderContract = JSON.parse(read(senderRoot, '408-DISCOVERY-1.1_CONTRACT.json'));
const receiverContract = JSON.parse(read(receiverRoot, 'CF-DISCOVERY-1.1_CONTRACT.json'));
const receiverPackage = JSON.parse(read(receiverRoot, 'package.json'));
const discoveryPage = read(receiverRoot, 'pvx/discovery/index.html');
const launcher = read(senderRoot, 'shared/coveragefit-launch.js');

check(senderContract.receiver === `CoverageFit v${receiverPackage.version}`, 'sender and receiver release versions match');
check(receiverContract.release === senderContract.receiver, 'receiver contract matches sender declaration');
check(senderContract.handoff_guardrails.endpoint === 'https://coveragefit.com/api/pvx/web-bootstrap', 'secure production bootstrap endpoint remains authoritative');
check(launcher.includes("bootstrapUrl: 'https://coveragefit.com/api/pvx/web-bootstrap'"), 'runtime launcher uses the certified bootstrap endpoint');
check(fs.existsSync(path.join(receiverRoot, 'functions/api/pvx/web-bootstrap.js')), 'receiver bootstrap Function exists');
check(discoveryPage.includes('class="pvx-button pvx-button--primary" href="/pvx/snapshot/"'), 'receiver makes Snapshot the primary next step');
check(discoveryPage.includes('pvx-discovery-conversion-1.1.css'), 'receiver loads the additive conversion-safe component');
check(receiverContract.conversion_guardrails.home_questions_remaining_after_408_entry_context === 4, 'home zero-repeat pacing is synchronized');
check(receiverContract.conversion_guardrails.buyer_questions_remaining_after_purchase_context === 5, 'buyer pacing is synchronized');
check(receiverContract.semantic_boundaries.automated_sms_permission_inferred === false, 'SMS permission boundary is synchronized');

console.log(JSON.stringify({ ok:true, build:'DISCOVERY-1.1', assertions }, null, 2));
