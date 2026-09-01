#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const receiverRoot = path.resolve(process.env.COVERAGEFIT_ROOT || path.join(root, '..', 'coveragefit'));
const read = (base, rel) => fs.readFileSync(path.join(base, rel), 'utf8');
const manifest = JSON.parse(read(root, 'handoff-manifest.json'));
const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };

check('public runtime preserves RC-SMS-1.9.1 after later public releases', ['408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read(root, 'VERSION').trim()) && ['408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(manifest.runtime) && manifest.smsSimulator.publicRuntimeChanged === false);
check('manifest preserves RC-SMS-1.9.1 in the current receiver', manifest.smsSimulator.build === 'RC-SMS-1.9.1' && ['CoverageFit v3.20.54','CoverageFit v3.20.55','CoverageFit v3.20.56','CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.smsSimulator.receiver) && ['CoverageFit v3.20.54','CoverageFit v3.20.55','CoverageFit v3.20.56','CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver));
const alerts = manifest.smsSimulator.producerQueueAlerts;
check('all bounded actionable events are published', ['intake_complete', 'personal_response_requested', 'direct_handling_required', 'automation_escalated'].every(value => alerts.actionableEvents.includes(value)));
check('delivery contract is deduplicated and nonblocking', alerts.idempotent === true && alerts.webhookBlocking === false && alerts.protectedTestAction === true);
check('privacy contract excludes lead detail', ['phone', 'address', 'closing date', 'transcript', 'partner identity', 'insurance details'].every(value => alerts.privacy.includes(value)));
check('number port remains deferred to RC-SMS-1.10', alerts.numberPorted === false && manifest.smsSimulator.numberPorted === false && manifest.smsSimulator.nextProductionSprint === 'RC-SMS-1.10');
check('CRO lead and intent contracts remain intact', manifest.intentPayoffAlignment.leadPointsPreserved === 2 && manifest.intentPayoffAlignment.formspreeHardGateAdded === false && manifest.professionalIntentContinuity.automatedEligibilityDecision === false);

check('paired CoverageFit release is present', ['3.20.54','3.20.55','3.20.56','3.20.57','3.20.58','3.20.59','3.20.60','3.20.61','3.20.62'].includes(read(receiverRoot, 'VERSION').trim()));
const receiverAlert = read(receiverRoot, 'server/sms-producer-alert.mjs');
const receiverConnection = read(receiverRoot, 'server/ringcentral-sms-connection-core.mjs');
const receiverOps = read(receiverRoot, 'server/sms-operations-core.mjs');
check('receiver implements privacy-safe event alert delivery', ['actionableSmsAlertType', 'coveragefit-sms-producer-alert', 'RCSMS_PRODUCER_ALERTS_ENABLED'].every(value => receiverAlert.includes(value)) && receiverConnection.includes('prepareSmsProducerAlert'));
check('receiver exposes protected test action and alert state', receiverOps.includes("action==='test_producer_alert'") && receiverOps.includes('normalizeSmsProducerAlert'));
check('synchronized documentation is packaged', fs.existsSync(path.join(root, 'SPRINT-408-RC-SMS-1.9.1.md')) && read(root, 'CHANGELOG.md').includes('Immediate Producer Queue Alert Synchronization'));

console.log(JSON.stringify({ sprint: '408-RC-SMS-1.9.1', passed: checks.length, failed: 0, checks }, null, 2));
