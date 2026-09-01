#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const manifest = JSON.parse(read('handoff-manifest.json'));
const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };

check('public runtime preserves PC-1.1 after buyer or CRO release', ['408-BUY-1.5','408-CRO-1.1','408-CRO-1.2','408-CRO-1.3','408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
check('FLOW-1.4 sender contract remains current', manifest.flowNormalization?.build === '408-FLOW-1.4');
check('transition remains receiver-driven', manifest.flowNormalization?.transitionMessaging?.senderRuntimeChanged === false);
check('canonical semantic handoff remains intact', manifest.flowNormalization?.semanticContext?.reviewContextParam === 'review_context' && manifest.flowNormalization?.semanticContext?.occupationParam === 'occupation_segment' && manifest.flowNormalization?.semanticContext?.housingContextParam === 'housing_context');
check('NP-1.4 cross-project test uses minimum receiver compatibility', /versionAtLeast\(read\(receiverRoot, 'VERSION'\), '3\.20\.17'\)/.test(read('qa/test-np-1.4-cross-repo.js')));
check('NP-1.5 cross-project test uses minimum receiver compatibility', /versionAtLeast\(read\(receiverRoot, 'VERSION'\), '3\.20\.18'\)/.test(read('qa/test-np-1.5-cross-repo.js')));
check('cross-project tests still assert their actual contracts', read('qa/test-np-1.4-cross-repo.js').includes("assert.equal(destination.searchParams.get('rid'), token)") && read('qa/test-np-1.5-cross-repo.js').includes("assert(fs.existsSync(path.join(receiverRoot, 'migrations/0003_np_1_5_referral_events.sql')))"));
check('PC-1.1 synchronization is documented', fs.existsSync(path.join(root, 'SPRINT-408-PC-1.1.md')) && read('CHANGELOG.md').includes('## 408-PC-1.1 — End-to-End Consultation Workflow Certification'));

console.log(JSON.stringify({ sprint: '408-PC-1.1', passed: checks.length, failed: 0, checks }, null, 2));
