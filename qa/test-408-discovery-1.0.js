'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const home = read('home/index.html');
const script = read('shared/script.js');
const launcherSource = read('shared/coveragefit-launch.js');
const contract = require(path.join(root, 'shared/home-journey-contract.js'));
const continuity = require(path.join(root, 'shared/home-continuity.js'));

let assertions = 0;
const check = (condition, message) => { assert.ok(condition, message); assertions += 1; };

check(contract.BUILD === '408-DISCOVERY-1.0', 'forward discovery build');
check(contract.allowed('review_timing', 'coordination') === 'coordination', 'coordination is bounded');
check(contract.allowed('review_timing', 'price_only') === 'price_only', 'price-only is bounded');
check(continuity.resolveBranch('renter').destinationType === 'coveragefit', 'renter remains in CoverageFit');
check(continuity.resolveBranch('renter').destination === '/pvx/discovery/', 'renter enters discovery');

const question1 = home.indexOf('What’s got you shopping right now?');
const question2 = home.indexOf('Besides price, anything you’d like to improve?');
const question3 = home.indexOf('Which best describes your home today?');
const checkpoint = home.indexOf('Keep your review connected.', question3);
check(question1 > 0 && question1 < question2 && question2 < question3 && question3 < checkpoint, 'three tap-only prompts precede the checkpoint');
check(/name="first_name"[^>]+required/.test(home), 'first name is required only when saving');
check(/name="phone"[^>]+required/.test(home), 'mobile is required only when saving');
check(/name="consent"[^>]+required/.test(home), 'explicit agency contact consent is required only when saving');
check(!/<input[^>]+name="last_name"/.test(home), 'checkpoint does not request last name');
check(!/<input[^>]+name="email"/.test(home), 'checkpoint does not request email');
check(!/<input[^>]+name="property_address"/.test(home), 'checkpoint does not request property address');
check(/data-continue-without-saving/.test(home), 'real anonymous continuation is present');
check(/data-cf-next="\/pvx\/discovery\/"/.test(home), 'home routes to discovery');
check(/lead_checkpoint_id/.test(home), 'durable checkpoint correlation field is present');
check(/We could not confirm that your information was saved/.test(script), 'transport failure is truthful');
check(/Continue without saving to keep going anonymously/.test(script), 'transport outage preserves anonymous continuation');
check(!/nativeFormspreeFallback/.test(script), 'no unconfirmed native navigation claims success');

function storage() {
  const values = new Map();
  return { getItem:key => values.get(key) || null, setItem:(key,value) => values.set(key,String(value)), removeItem:key => values.delete(key) };
}
const window = {
  location:{ pathname:'/home/', search:'', origin:'https://408farmers.com' },
  sessionStorage:storage(), localStorage:storage(),
  crypto:{ randomUUID:() => '11111111-2222-4333-8444-555555555555' },
  dataLayer:[], CustomEvent:function CustomEvent(name, init){ this.type=name; this.detail=init?.detail; }
};
const document = {
  readyState:'complete',
  querySelectorAll:() => [],
  dispatchEvent:() => true,
  createElement:() => ({ appendChild(){}, submit(){}, style:{}, set hidden(value){ this._hidden=value; } }),
  body:{ appendChild(){} }
};
const context = vm.createContext({ window, document, URL, URLSearchParams, Set, Object, String, Math, Date });
vm.runInContext(launcherSource, context, { filename:'coveragefit-launch.js' });
const profile = {
  firstName:'Avery', phone:'4085550100', housingContext:'owner_occupied', homeReviewGoal:'exploring', reviewTiming:'shopping_now',
  leadCheckpointId:'408d_abcdefghijklmnop', contactPermission:{ confirmed:true, capturedAt:'2026-08-29T12:00:00.000Z', version:'agency-contact-v2' }
};
const confirmed = window.CoverageFitLauncher.buildPayload({ profile, entry:'home_lander_form', extra:{ lead_capture_status:'confirmed', contact_consent:'true', consent_at:'2026-08-29T12:00:00.000Z', consent_version:'agency-contact-v2' } });
check(confirmed.first_name === 'Avery' && confirmed.phone === '4085550100', 'confirmed identity is carried in the secure POST body');
check(confirmed.discovery_shopping_reason === 'comparison', 'prior tap is reused as discovery seed');
check(confirmed.discovery_improvement_priorities === 'understanding', 'improvement tap is reused as discovery seed');
const anonymous = window.CoverageFitLauncher.buildPayload({ profile, entry:'home_lander_form', extra:{ lead_capture_status:'skipped', contact_consent:'false' } });
check(!anonymous.first_name && !anonymous.phone && anonymous.lead_capture_status === 'skipped', 'anonymous skip carries no PII');
const visibleUrl = window.CoverageFitLauncher.buildUrl({ profile, entry:'home_lander_form' });
check(!/Avery|4085550100|consent/i.test(visibleUrl), 'visible URL contains no contact PII');
check(window.CoverageFitLauncher.defaults.bootstrapUrl === 'https://coveragefit.com/api/pvx/web-bootstrap', 'secure native bootstrap is authoritative');
check(!/console\.(?:log|debug|info)\(/.test(launcherSource + script), 'no PII-prone console logging was added');

for (const route of ['auto-bundle/index.html','buyer/index.html']) {
  check(/data-cf-next="\/pvx\/discovery\/"/.test(read(route)), `${route} enters discovery`);
}

console.log(JSON.stringify({ ok:true, build:'408-DISCOVERY-1.0', assertions }, null, 2));

