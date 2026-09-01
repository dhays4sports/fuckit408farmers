'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const launcherCode = fs.readFileSync(path.join(root, 'shared/coveragefit-launch.js'), 'utf8');

function storage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: k => values.has(k) ? values.get(k) : null,
    setItem: (k,v) => values.set(k, String(v)),
    removeItem: k => values.delete(k),
    dump: () => Object.fromEntries(values.entries())
  };
}

function createEnv(url, localSeed = {}, sessionSeed = {}) {
  const u = new URL(url);
  const localStorage = storage(localSeed);
  const sessionStorage = storage(sessionSeed);
  const dataLayer = [];
  const listeners = {};
  const document = {
    readyState: 'complete',
    querySelectorAll: () => [],
    addEventListener: (name, fn) => { listeners[name] = fn; },
    dispatchEvent: evt => { listeners[evt.type] = evt; }
  };
  const window = {
    location: {
      origin: u.origin,
      pathname: u.pathname,
      search: u.search,
      assigned: null,
      assign(dest) { this.assigned = dest; }
    },
    localStorage,
    sessionStorage,
    dataLayer,
    crypto: { randomUUID: () => '11111111-2222-4333-8444-555555555555' },
    CustomEvent: function(type, init){ this.type = type; this.detail = init.detail; },
    LANDING_PAGE_CONFIG: {
      coverageFitTransitionUrl: 'https://coveragefit.com/transition/',
      coverageFitHomeUrl: 'https://coveragefit.com/home/',
      coverageFitFallbackUrl: '/home#form'
    }
  };
  const context = vm.createContext({ window, document, URL, URLSearchParams, Object, Date, Math, console });
  vm.runInContext(launcherCode, context);
  return { window, document, localStorage, sessionStorage, dataLayer };
}

const tests = [];
function test(name, fn) { tests.push({name, fn}); }

test('direct score entry builds canonical CoverageFit URL', () => {
  const env = createEnv('https://408farmers.com/score/');
  const dest = env.window.CoverageFitLauncher.buildUrl({entry:'score', assessment:'home', next:'/assessment/', extra:{launch_surface:'home_protection_score'}});
  const u = new URL(dest);
  assert.equal(u.origin + u.pathname, 'https://coveragefit.com/transition/');
  assert.equal(u.searchParams.get('next'), '/assessment/');
  assert.equal(u.searchParams.get('campaign'), 'direct');
  assert.equal(u.searchParams.get('source'), '408farmers');
  assert.equal(u.searchParams.get('entry'), 'score');
  assert.equal(u.searchParams.get('assessment'), 'home');
  assert.equal(u.searchParams.get('launch_surface'), 'home_protection_score');
});

test('doorhanger and UTM attribution pass through', () => {
  const env = createEnv('https://408farmers.com/score/?campaign=doorhanger&utm_source=qr&utm_medium=offline&utm_campaign=mission_san_jose&utm_content=v3');
  const u = new URL(env.window.CoverageFitLauncher.buildUrl({entry:'score'}));
  ['campaign','utm_source','utm_medium','utm_campaign','utm_content'].forEach(k => assert.ok(u.searchParams.get(k), k));
  assert.equal(u.searchParams.get('campaign'), 'doorhanger');
  assert.equal(u.searchParams.get('utm_campaign'), 'mission_san_jose');
});

test('session ID is stable for repeated launches', () => {
  const env = createEnv('https://408farmers.com/');
  const a = new URL(env.window.CoverageFitLauncher.buildUrl({entry:'homepage_hero'}));
  const b = new URL(env.window.CoverageFitLauncher.buildUrl({entry:'homepage_home_intent'}));
  assert.equal(a.searchParams.get('session_id'), b.searchParams.get('session_id'));
});

test('launch emits vendor-neutral analytics before navigation', () => {
  const env = createEnv('https://408farmers.com/?campaign=meta-home');
  const dest = env.window.CoverageFitLauncher.launch({entry:'homepage_hero'});
  assert.equal(env.window.location.assigned, dest);
  const evt = env.dataLayer.find(x => x.event === 'coveragefit_assessment_launch');
  assert.ok(evt);
  assert.equal(evt.campaign, 'meta-home');
  assert.equal(evt.entry, 'homepage_hero');
});

test('invalid base URL falls back safely', () => {
  const env = createEnv('https://408farmers.com/score/');
  const dest = env.window.CoverageFitLauncher.launch({baseUrl:'http://[bad', entry:'score', fallbackUrl:'/home#form'});
  assert.equal(dest, '/home#form');
  assert.equal(env.window.location.assigned, '/home#form');
  assert.ok(env.dataLayer.some(x => x.event === 'coveragefit_launch_fallback'));
});

test('stored campaign is reused on later pages', () => {
  const env = createEnv('https://408farmers.com/home/', {cf_campaign:'referral'});
  const u = new URL(env.window.CoverageFitLauncher.buildUrl({entry:'home_lander_form'}));
  assert.equal(u.searchParams.get('campaign'), 'referral');
});

let failures = 0;
for (const t of tests) {
  try { t.fn(); console.log('PASS', t.name); }
  catch (e) { failures++; console.error('FAIL', t.name, '\n ', e.stack); }
}
console.log(`\n${tests.length - failures}/${tests.length} tests passed`);
process.exitCode = failures ? 1 : 0;
