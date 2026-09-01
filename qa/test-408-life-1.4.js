#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const checks = [];
function check(name, value) { assert.ok(value, name); checks.push(name); }

const version = read('VERSION').trim();
const manifest = JSON.parse(read('handoff-manifest.json'));
const client = read('shared/life-secure-submit.js');
const worker = read('_worker.js');
const privacy = read('privacy.html');

check('LIFE-1.4 secure boundary is preserved by current release', ['408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(version));
check('same-origin LIFE endpoint remains stable', client.includes("var ENDPOINT = '/api/life/application-init';"));
check('secure submission remains enabled', manifest.lifeCampaignFoundation?.secureSubmissionBoundaryEnabled === true && manifest.lifeCampaignFoundation?.sensitiveNetworkSubmissionEnabled === true);
check('sensitive browser persistence remains disabled', !/localStorage|sessionStorage|indexedDB|document\.cookie/i.test(client) && (manifest.lifeCampaignFoundation?.producerQueueBrowserPersistence === false || manifest.lifeCampaignFoundation?.sensitivePersistenceEnabled === false));
check('sensitive analytics remain disabled', manifest.lifeCampaignFoundation?.sensitiveAnalyticsEnabled === false && !/dataLayer|gtag\s*\(|sendBeacon|facebook|pixel/i.test(client));
check('Formspree and CoverageFit remain outside LIFE transport', !/formspree|coveragefit/i.test(client) && !/formspree|coveragefit/i.test(worker));
check('server boundary still rejects unexpected fields through exact-key validation', worker.includes('exactKeys(payload') && worker.includes('exactKeys(payload.applicant'));
check('last4 remains exactly four digits', worker.includes("/^\\d{4}$/.test(applicant.ssn_last4)"));
check('server-side producer boundary remains authenticated', ['408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(version) ? (worker.includes('Cf-Access-Jwt-Assertion') && worker.includes('LIFE_PRODUCER_EMAILS') && worker.includes('LIFE_QUEUE_DB')) : ['Authorization','X-408-Life-Signature','X-408-Life-Timestamp','X-Idempotency-Key'].every(v => worker.includes(v)));
check('server response remains generic', worker.includes("jsonResponse(202, { ok: true })"));
check('dedicated privacy notice remains present', privacy.includes('id="life-application-start"'));
check('paid traffic gate resolves only at final LIFE certification', manifest.lifeCampaignFoundation?.build==='408-LIFE-1.7' ? manifest.lifeCampaignFoundation?.paidTrafficReady===true : (manifest.lifeCampaignFoundation?.paidTrafficReady===false && /LIFE-1\.[57]/.test(manifest.lifeCampaignFoundation?.paidTrafficGate || '')));
check('current deployment doc exists', exists('LIFE-SECURE-SUBMISSION-DEPLOYMENT.md'));

const report = { sprint: '408-LIFE-1.4-preservation', passed: checks.length, failed: 0, checks };
console.log(JSON.stringify(report, null, 2));
