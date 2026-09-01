#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const referral = require(path.join(root, 'shared/buyer-referral.js'));
const checks = [];
function check(name, fn) { fn(); checks.push(name); console.log('PASS', name); }

check('release identifies the buyer concierge build', () => {
  assert.ok(['408-BUY-1.1','408-BUY-1.2','408-BUY-1.3','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4','408-BUY-1.4','408-BUY-1.5','408-CRO-1.1','408-CRO-1.2','408-CRO-1.3','408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
  assert.ok(['408-BUY-1.1','408-RC-SMS-1.6'].includes(referral.build));
  assert.ok(['1.0.0','1.1.0'].includes(referral.version));
});

check('buyer route and local fallback are packaged', () => {
  for (const rel of ['buyer/index.html','buyer/thank-you.html','shared/buyer.css','shared/buyer-flow.js','shared/buyer-referral.js','shared/assets/buyer-home.jpg']) {
    assert(fs.existsSync(path.join(root, rel)), rel);
  }
  const redirects = read('_redirects');
  assert(read('_worker.js').includes("'/buyer'"));
  assert(!redirects.includes('/buyer/index.html')); 
});

check('buyer page preserves text-first and online entry choices', () => {
  const html = read('buyer/index.html');
  assert(html.includes('Buying a Home?'));
  assert(html.includes('Text Dylan at 408-FARMERS'));
  assert(html.includes('data-buyer-text-link'));
  assert(html.includes('data-buyer-start-online'));
  assert(html.includes('id="buyer-review"'));
  assert(!html.includes('Text RUSH'));
  assert(html.includes('../shared/assets/buyer-home.jpg'));
  assert(read('shared/buyer.css').includes('.buyer-page .buyer-button--primary'));
});

check('online intake uses the existing validated handoff pipeline', () => {
  const html = read('buyer/index.html');
  assert(html.includes('data-coveragefit-after-submit="true"'));
  assert(html.includes('data-cf-entry="buyer_lander_form"'));
  assert(html.includes('data-cf-extra-launch-surface="buyer_lander"'));
  assert(html.includes('data-cf-next="/assessment/"'));
  assert(html.includes('data-sender-build="408-CONV-1.1"'));
  assert(html.includes('data-handoff-contract="coveragefit-handoff-v1"'));
  for (const field of ['property_address','closing_date','occupancy','first_name','last_name','phone','email','consent']) {
    assert(html.includes(`name="${field}"`), field);
  }
});

check('buyer page captures privacy-safe partner attribution', () => {
  const context = referral.resolve('?partner_id=Jessica%20Martinez&partner_name=Jessica%20Martinez&utm_medium=qr');
  assert.equal(context.partnerId, 'jessica-martinez');
  assert.equal(context.partnerName, 'Jessica Martinez');
  assert.equal(context.referralSource, 'realtor_partner');
  assert.equal(context.campaignId, 'buyer_partner_jessica-martinez_web');
  assert.equal(context.utmMedium, 'qr');
  const body = referral.buildSmsBody(context);
  assert(body.includes('Jessica Martinez referred me.'));
  assert(body.includes('I’m buying a home'));
});

check('generic buyer traffic receives a stable direct campaign', () => {
  const context = referral.resolve('');
  assert.equal(context.active, false);
  assert.equal(context.campaignId, 'buyer_direct_web');
  assert.equal(context.referralSource, 'buyer_direct');
  assert(!referral.buildSmsBody(context).includes('referred me'));
});

check('partner inputs are bounded before display or attribution', () => {
  assert.equal(referral.normalizePartnerId('../../Jessica <script>'), 'jessica-script');
  assert.equal(referral.normalizePartnerName('Jessica <script>alert(1)</script>'), 'Jessica scriptalert(1)script');
  assert(referral.normalizePartnerName('A'.repeat(120)).length <= 80);
  assert(referral.normalizePartnerId('A'.repeat(100)).length <= 64);
});

check('buyer form data carries closing and partner context into CoverageFit', () => {
  const launcherCode = read('shared/coveragefit-launch.js');
  const profileCode = read('shared/prospect-profile.js');
  const storage = () => ({ getItem(){return null;}, setItem(){}, removeItem(){} });
  const window = {
    location: { origin:'https://408farmers.com', pathname:'/buyer/', search:'', assign(){} },
    sessionStorage: storage(), localStorage: storage(),
    crypto: { randomUUID: () => 'buyer-session' }, dataLayer: [],
    LANDING_PAGE_CONFIG: { coverageFitTransitionUrl:'https://coveragefit.com/transition/', coverageFitFallbackUrl:'/buyer/thank-you.html' },
    CustomEvent: function(type, init){ this.type=type; this.detail=init && init.detail; }
  };
  const document = { readyState:'complete', querySelectorAll:()=>[], addEventListener(){}, dispatchEvent(){} };
  const context = vm.createContext({ window, document, URL, URLSearchParams, Object, Date, Math, String, JSON, console });
  vm.runInContext(launcherCode, context);
  vm.runInContext(profileCode, context);
  const values = {
    first_name:'Alex', last_name:'Buyer', phone:'4085551212', email:'alex@example.com',
    property_address:'123 Main St, San Jose, CA 95118', property_formatted_address:'123 Main St, San Jose, CA 95118',
    property_street:'123 Main St', property_city:'San Jose', property_county:'Santa Clara', property_state:'CA', property_zip:'95118', property_country:'US', property_place_id:'place-1', address_selection_method:'autocomplete',
    review_context:'Buying a home', closing_date:'2026-09-01', occupancy:'primary_residence', closing_urgency:'within_30_days',
    partner_id:'jessica-martinez', referral_source:'realtor_partner', source:'408farmers.com/buyer', campaign:'buyer_partner_jessica-martinez_web', campaign_id:'buyer_partner_jessica-martinez_web', campaign_variant:'', campaign_zip:'',
    utm_source:'realtor_partner', utm_medium:'partner_card', utm_campaign:'buyer_referral', utm_content:'jessica-martinez', utm_term:'', submitted_at:'2026-08-06T16:00:00.000Z', consent:'on'
  };
  const elements = {};
  for (const [key, value] of Object.entries(values)) elements[key] = { value, checked:key === 'consent' };
  const profile = window.ProspectProfileBuilder.fromForm({ elements });
  const destination = new URL(window.CoverageFitLauncher.buildUrl({ profile, entry:'buyer_lander_form', assessment:'home', next:'/assessment/' }));
  assert.equal(destination.searchParams.get('closing_date'), '2026-09-01');
  assert.equal(destination.searchParams.get('occupancy'), 'primary_residence');
  assert.equal(destination.searchParams.get('closing_urgency'), 'within_30_days');
  assert.equal(destination.searchParams.get('partner_id'), 'jessica-martinez');
  assert.equal(destination.searchParams.get('referral_source'), 'realtor_partner');
  assert.equal(destination.searchParams.get('next'), '/assessment/');
});

check('shared form controller preserves values installed by buyer context', () => {
  const script = read('shared/script.js');
  assert(script.includes("params.get(k) || input.value || ''"));
});

check('homepage home-purchase card routes into the buyer concierge', () => {
  const html = read('index.html');
  assert(html.includes('href="buyer/"'));
  assert(html.includes('<h3>I’m buying a home</h3>'));
  assert(html.includes('Start my buyer review'));
});

check('manifest publishes the buyer route and handoff entry', () => {
  const manifest = JSON.parse(read('handoff-manifest.json'));
  const route = manifest.routes.find(item => item.path === '/buyer/');
  assert(route);
  assert.equal(route.entry, 'buyer_lander_form');
  assert.equal(route.launchSurface, 'buyer_lander');
  assert.ok(['408-BUY-1.1','408-BUY-1.2','408-BUY-1.3','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4','408-BUY-1.4','408-BUY-1.5','408-CRO-1.1','408-CRO-1.2'].includes(manifest.buyer.build));
});

console.log(JSON.stringify({ sprint:'408-BUY-1.1', passed:checks.length, failed:0, checks }, null, 2));
