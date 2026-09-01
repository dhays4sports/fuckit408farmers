#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));
const manifest = JSON.parse(read('handoff-manifest.json'));
const buyer = read('buyer/index.html');
const buyerCss = read('shared/buyer.css');
const redirects = read('_redirects');
const referral = require(path.join(root, 'shared/buyer-referral.js'));
const checks = [];

function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
  console.log('PASS', name);
}

check('runtime preserves the entry-integrity release after later CRO work', ['408-CRO-1.1', '408-CRO-1.2', '408-CRO-1.3','408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
check('manifest preserves the stable handoff build after later CRO work', ['408-CRO-1.1', '408-CRO-1.2', '408-CRO-1.3','408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(manifest.runtime) && manifest.build === '408-CONV-1.1');
check('direct buyer referral acknowledgement starts hidden', /data-buyer-referral\s+hidden/.test(buyer));
check('hidden referral acknowledgement has an explicit rendered-state rule', /\.buyer-referral-pill\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*\}/.test(buyerCss));

const direct = referral.resolve('');
const referred = referral.resolve('?partner_id=sample-realty&partner_name=Sample%20Realty&partner_code=HOME24');
check('direct buyer context does not activate referral personalization', direct.active === false && direct.referralSource === 'buyer_direct');
check('referred buyer context preserves bounded personalization', referred.active === true && referred.partnerId === 'sample-realty' && referred.partnerName === 'Sample Realty' && referred.partnerCode === 'HOME24');
check('buyer controller only reveals the acknowledgement when a partner name exists', /if \(context\.partnerName && referralBanner && referralName\)/.test(read('shared/buyer-flow.js')) && /referralBanner\.hidden = false/.test(read('shared/buyer-flow.js')));
check('buyer controller renders partner identity with textContent', /referralName\.textContent = context\.partnerName/.test(read('shared/buyer-flow.js')));

check('legacy Home alternate is removed from the deployable project', !exists('home/Wowindex.html'));
check('legacy Home URL is owned by Advanced Mode Worker', read('_worker.js').includes("path === '/home/Wowindex.html'") && read('_worker.js').includes("redirect: '/home/'"));
check('static redirects contain no index.html application rewrites', !redirects.includes('/home/* /home/index.html 200'));

const publicFormPages = ['home/index.html', 'buyer/index.html', 'auto-bundle/index.html', 'healthcare/index.html', 'teachers/index.html', 'tech/index.html', 'engineers/index.html'];
check('no production form uses legacy segment as its canonical field', publicFormPages.every(relative => !/name=["']segment["']/.test(read(relative))));
check('canonical Home route retains review and flyer fields', ['review_context', 'campaign_id', 'campaign_variant', 'campaign_zip'].every(field => read('home/index.html').includes(`name="${field}"`)));

check('manifest identifies the current paired CoverageFit release', ['CoverageFit v3.20.51','CoverageFit v3.20.52','CoverageFit v3.20.53','CoverageFit v3.20.54','CoverageFit v3.20.55','CoverageFit v3.20.56','CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver) && /CoverageFit_v3\.20\.(51|52|53|54|55|56|57|58|59|60|61)_/.test(manifest.receiverRelease));
check('manifest retains the audited minimum receiver compatibility', manifest.minimumCompatibleReceiver === 'CoverageFit v3.20.13');
check('implemented SMS architecture is preserved', ['RC-SMS-1.9', 'RC-SMS-1.9.1'].includes(manifest.smsSimulator.build) && manifest.smsSimulator.liveConnectionImplemented === true && manifest.smsSimulator.ringCentralRequiredForLive === true);
check('production SMS state is truthful while the number port is pending', manifest.smsSimulator.liveSms === false && manifest.smsSimulator.numberPorted === false && manifest.smsSimulator.productionCertification === 'deferred_until_408_farmers_number_port' && manifest.smsSimulator.nextProductionSprint === 'RC-SMS-1.10');
check('public project still contains no RingCentral credentials', !read('handoff-manifest.json').includes('RINGCENTRAL_CLIENT_SECRET') && !read('handoff-manifest.json').includes('RINGCENTRAL_JWT_TOKEN'));
check('sprint documentation records the entry-integrity boundary', exists('SPRINT-408-CRO-1.1.md') && /CoverageFit was not modified/.test(read('SPRINT-408-CRO-1.1.md')));

console.log(JSON.stringify({ sprint: '408-CRO-1.1', passed: checks.length, failed: 0, checks }, null, 2));
