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
assert(fs.existsSync(path.join(receiverRoot, 'VERSION')), 'Set COVERAGEFIT_ROOT to the CoverageFit NP-1.5 project root.');

const senderCampaign = require(path.join(senderRoot, 'shared/flyer-campaign.js'));
const receiverCampaign = require(path.join(receiverRoot, 'assets/js/campaign-identifiers.js'));
const bridge = require(path.join(senderRoot, 'shared/referral-bridge.js'));
const referralClient = require(path.join(receiverRoot, 'assets/js/referral-attribution.js'));

assert.ok(['408-BUY-1.1','408-BUY-1.2','408-BUY-1.3','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4','408-BUY-1.5','408-CRO-1.1','408-CRO-1.2','408-CRO-1.3','408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read(senderRoot, 'VERSION').trim()));
assert(versionAtLeast(read(receiverRoot, 'VERSION'), '3.20.18'));
assert.equal(referralClient.BUILD, 'NP-1.5');

for (const zip of ['95118','10001','02108','30301','60601','90210']) {
  for (const variant of ['rate','fit']) {
    assert.equal(senderCampaign.campaignId(zip, variant), receiverCampaign.campaignId(zip, variant));
    assert.equal(senderCampaign.campaignId(zip, variant), `home_flyer_${zip}_${variant}`);
  }
}

const token = `ref_${'D'.repeat(16)}`;
const senderRoute = bridge.readRoute({
  pathname: `/neighbor/r/${token}`,
  search: '?share=copy&campaign_zip=94105&campaign_variant=fit&campaign_id=home_flyer_94105_fit'
});
const destination = new URL(bridge.buildDestination(senderRoute));
assert.equal(destination.origin + destination.pathname, 'https://coveragefit.com/home/');
assert.equal(destination.searchParams.get('rid'), token);
assert.equal(destination.searchParams.get('campaign_id'), 'home_flyer_94105_fit');
assert.equal(destination.searchParams.get('campaign_variant'), 'fit');
assert.equal(destination.searchParams.get('campaign_zip'), '94105');

const attribution = read(receiverRoot, 'assets/js/attribution.js');
const assessment = read(receiverRoot, 'assets/js/assessment-engine.js');
const eventCore = read(receiverRoot, 'server/referral-event-core.mjs');
['campaign_id','campaign_variant','campaign_zip'].forEach(field => assert(attribution.includes(`'${field}'`)));
['campaignId','campaignVariant','campaignZip','referralId','referralSource','referralChannel'].forEach(field => assert(assessment.includes(field)));
['neighbor_share_view','neighbor_share_click','neighbor_referral_visit','neighbor_referral_start','neighbor_referral_complete'].forEach(event => assert(eventCore.includes(event)));
assert(fs.existsSync(path.join(receiverRoot, 'functions/api/referrals/event.js')));
assert(fs.existsSync(path.join(receiverRoot, 'migrations/0003_np_1_5_referral_events.sql')));

console.log('PASS NP-1.5 cross-repository any-ZIP campaign and referral attribution contract');
