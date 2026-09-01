#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const campaign = require(path.join(root, 'shared/flyer-campaign.js'));
const bridge = require(path.join(root, 'shared/referral-bridge.js'));
const checks = [];
function check(name, fn) { fn(); checks.push(name); console.log('PASS', name); }

check('current release preserves the 408-NP-1.5 subsystem', () => {
  assert.ok(['408-BUY-1.1','408-BUY-1.2','408-BUY-1.3','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4','408-BUY-1.4','408-BUY-1.5','408-CRO-1.1','408-CRO-1.2','408-CRO-1.3','408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
  assert.ok(['1.0.0', '2.0.0'].includes(campaign.VERSION));
  assert.ok(['408-NP-1.5', '408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(campaign.BUILD));
  assert.equal(bridge.VERSION, '1.1.0');
  assert.equal(bridge.BUILD, '408-NP-1.5');
});

[
  ['95118','A','home_flyer_95118_rate'],
  ['95118','B','home_flyer_95118_fit'],
  ['10001','rate','home_flyer_10001_rate'],
  ['10001','fit','home_flyer_10001_fit'],
  ['02108','competitive rate','home_flyer_02108_rate'],
  ['33131','strong fit','home_flyer_33131_fit']
].forEach(([zip, variant, expected]) => {
  check(`generic campaign identifier ${expected}`, () => assert.equal(campaign.campaignId(zip, variant), expected));
});

check('invalid ZIP and variant values cannot create a flyer campaign', () => {
  assert.equal(campaign.campaignId('9511', 'rate'), '');
  assert.equal(campaign.campaignId('95118', 'other'), '');
  assert.equal(campaign.resolve({ campaign_zip: 'not-a-zip', campaign_variant: 'A' }).active, false);
});

check('readable QR inputs normalize into canonical campaign fields', () => {
  const a = campaign.readSearch('?campaign_zip=60601&campaign_variant=A&utm_source=flyer&utm_medium=qr');
  const b = campaign.readSearch('?campaign_zip=60601&campaign_variant=B&utm_source=flyer&utm_medium=qr');
  assert.equal(a.campaignId, 'home_flyer_60601_rate');
  assert.equal(a.campaignVariant, 'rate');
  assert.equal(a.campaignZip, '60601');
  assert.equal(b.campaignId, 'home_flyer_60601_fit');
});

check('campaign values are installed on the existing form without a parallel form', () => {
  const values = {};
  const inputs = {};
  function input(name) { return inputs[name] || null; }
  const form = {
    ownerDocument: {
      createElement() {
        return {
          type: '',
          name: '',
          value: '',
          set value(v) { this._value = v; values[this.name] = v; },
          get value() { return this._value || ''; }
        };
      }
    },
    querySelector(selector) {
      const match = selector.match(/\[name="([^"]+)"\]/);
      return match ? input(match[1]) : null;
    },
    appendChild(node) {
      inputs[node.name] = node;
      values[node.name] = node.value;
    }
  };
  const resolved = campaign.applyToForm(form, '?campaign_zip=30301&campaign_variant=fit');
  assert.equal(resolved.campaignId, 'home_flyer_30301_fit');
  assert.equal(values.campaign, 'home_flyer_30301_fit');
  assert.equal(values.campaign_id, 'home_flyer_30301_fit');
  assert.equal(values.campaign_variant, 'fit');
  assert.equal(values.campaign_zip, '30301');
  assert.equal(values.utm_content, 'home_flyer_30301_fit');
});

check('Home route loads campaign normalization before launcher and form behavior', () => {
  const html = read('home/index.html');
  const campaignIndex = html.indexOf('/shared/flyer-campaign.js');
  assert(campaignIndex >= 0);
  assert(campaignIndex < html.indexOf('/shared/coveragefit-launch.js'));
  assert(campaignIndex < html.indexOf('/shared/script.js'));
  ['campaign_id','campaign_variant','campaign_zip'].forEach(name => assert(html.includes(`name="${name}"`)));
});

check('launcher and prospect profile preserve canonical campaign fields', () => {
  const launcher = read('shared/coveragefit-launch.js');
  const profile = read('shared/prospect-profile.js');
  ['campaign_id','campaign_variant','campaign_zip'].forEach(field => {
    assert(launcher.includes(`'${field}'`));
  });
  ['campaignId','campaignVariant','campaignZip'].forEach(field => assert(profile.includes(field)));
  assert(launcher.includes('Farmers408FlyerCampaign.apply'));
});

check('branded referral bridge forwards generic campaign identity fields', () => {
  const token = `ref_${'C'.repeat(16)}`;
  const route = bridge.readRoute({
    pathname: `/neighbor/r/${token}`,
    search: '?share=sms&campaign_id=home_flyer_90210_fit&campaign_variant=fit&campaign_zip=90210'
  });
  const destination = new URL(bridge.buildDestination(route));
  assert.equal(destination.searchParams.get('campaign_id'), 'home_flyer_90210_fit');
  assert.equal(destination.searchParams.get('campaign_variant'), 'fit');
  assert.equal(destination.searchParams.get('campaign_zip'), '90210');
  assert.equal(destination.searchParams.get('rid'), token);
});

check('manifest publishes the NP-1.5 receiver and any-ZIP contract', () => {
  const manifest = JSON.parse(read('handoff-manifest.json'));
  assert.equal(manifest.referralBridge.build, '408-NP-1.5');
  assert.equal(manifest.referralBridge.receiver, 'CoverageFit v3.20.18');
  assert.equal(manifest.referralBridge.attribution.campaignIdPattern, 'home_flyer_{ZIP}_{rate|fit}');
  assert.equal(manifest.referralBridge.attribution.campaignZip, 'any-five-digit-ZIP');
});

check('campaign documentation provides reusable A and B QR templates', () => {
  const doc = read('FLYER-CAMPAIGN-IDENTIFIERS.md');
  assert(doc.includes('campaign_zip=<ZIP>'));
  assert(doc.includes('campaign_variant=rate'));
  assert(doc.includes('campaign_variant=fit'));
  assert(doc.includes('home_flyer_<ZIP>_rate'));
  assert(doc.includes('home_flyer_<ZIP>_fit'));
});

console.log(JSON.stringify({ sprint: '408-NP-1.5', passed: checks.length, failed: 0, checks }, null, 2));
