#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const manifest=JSON.parse(fs.readFileSync('handoff-manifest.json','utf8'));
const buyer=fs.readFileSync('buyer/index.html','utf8');
assert.ok(['408-BUY-1.1','408-BUY-1.2','408-BUY-1.3','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4','408-BUY-1.5','408-CRO-1.1','408-CRO-1.2','408-CRO-1.3','408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(fs.readFileSync('VERSION','utf8').trim()));
assert.ok(['CoverageFit v3.20.51','CoverageFit v3.20.52','CoverageFit v3.20.53','CoverageFit v3.20.54','CoverageFit v3.20.55','CoverageFit v3.20.56','CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver));
assert.equal(manifest.minimumCompatibleReceiver,'CoverageFit v3.20.13');
assert.ok(['CoverageFit v3.20.19','CoverageFit v3.20.20','CoverageFit v3.20.21','CoverageFit v3.20.22','CoverageFit v3.20.23','CoverageFit v3.20.24','CoverageFit v3.20.25','CoverageFit v3.20.26','CoverageFit v3.20.27','CoverageFit v3.20.54','CoverageFit v3.20.55','CoverageFit v3.20.56','CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.smsSimulator.receiver));
assert.ok(['RC-SMS-1.1','RC-SMS-1.2','RC-SMS-1.3','RC-SMS-1.4','RC-SMS-1.5','RC-SMS-1.6','RC-SMS-1.7','RC-SMS-1.8','RC-SMS-1.9','RC-SMS-1.9.1'].includes(manifest.smsSimulator.build));
assert.equal(typeof manifest.smsSimulator.liveSms,'boolean');
assert.ok(manifest.smsSimulator.build === 'RC-SMS-1.1' ? manifest.smsSimulator.ringCentralRequired === false : manifest.smsSimulator.ringCentralRequiredForLive === true);
assert.ok(buyer.includes('Text Dylan at 408-FARMERS'));
assert.ok(/online/i.test(buyer));
assert.ok(!JSON.stringify(manifest.smsSimulator || {}).match(/clientSecret|webhookSecret|RINGCENTRAL_CLIENT_SECRET|RINGCENTRAL_JWT/i));
console.log(JSON.stringify({sprint:'408-RC-SMS-1.1',passed:10,failed:0},null,2));
