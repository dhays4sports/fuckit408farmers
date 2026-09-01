'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const launcherCode = read('shared/coveragefit-launch.js');
const profileCode = read('shared/prospect-profile.js');
const sharedFormCode = read('shared/script.js');

const handoffPages = [
  { rel: 'home/index.html', entry: 'home_lander_form', surface: 'home_lander' },
  { rel: 'tech/index.html', entry: 'tech_eligibility_form', surface: 'occupation_tech' },
  { rel: 'engineers/index.html', entry: 'engineers_eligibility_form', surface: 'occupation_engineer' },
  { rel: 'healthcare/index.html', entry: 'healthcare_eligibility_form', surface: 'occupation_healthcare' },
  { rel: 'teachers/index.html', entry: 'teachers_eligibility_form', surface: 'occupation_education' }
];

function attribute(html, name) {
  const match = html.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : '';
}

function hiddenValue(html, name) {
  const patterns = [
    new RegExp(`<input[^>]*name="${name}"[^>]*value="([^"]*)"[^>]*>`, 'i'),
    new RegExp(`<input[^>]*value="([^"]*)"[^>]*name="${name}"[^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return '';
}

function storage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function createRuntime(pathname) {
  const window = {
    location: {
      origin: 'https://408farmers.com',
      pathname,
      search: '',
      assign() {}
    },
    sessionStorage: storage(),
    localStorage: storage(),
    crypto: { randomUUID: () => 'handoff-session-123' },
    dataLayer: [],
    CustomEvent: function(type, init) { this.type = type; this.detail = init.detail; },
    LANDING_PAGE_CONFIG: {
      coverageFitHomeUrl: 'https://coveragefit.com/home/',
      coverageFitFallbackUrl: '/home#form'
    }
  };
  const document = {
    readyState: 'complete',
    querySelectorAll: () => [],
    addEventListener() {},
    dispatchEvent() {}
  };
  const context = vm.createContext({
    window, document, URL, URLSearchParams, Object, Date, Math, String, JSON, console
  });
  vm.runInContext(launcherCode, context);
  vm.runInContext(profileCode, context);
  return window;
}

function fakeForm(campaign, source, reviewContext) {
  const values = {
    first_name: 'Dylan',
    last_name: 'Haysbert',
    phone: '(408) 327-6377',
    email: 'DYLAN@example.com',
    property_address: '123 Main St, Fremont, CA 94539',
    property_formatted_address: '',
    property_street: '',
    property_city: '',
    property_county: '',
    property_state: '',
    property_zip: '',
    property_country: '',
    property_place_id: '',
    address_selection_method: '',
    review_context: reviewContext,
    occupation_segment: '',
    housing_context: '',
    campaign,
    source,
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: ''
  };
  const elements = {};
  Object.keys(values).forEach(key => { elements[key] = { value: values[key] }; });
  return { elements };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

for (const page of handoffPages) {
  test(`${page.rel} loads the canonical profile pipeline`, () => {
    const html = read(page.rel);
    assert(html.includes('data-coveragefit-after-submit="true"'));
    assert.equal(attribute(html, 'data-cf-entry'), page.entry);
    assert.equal(attribute(html, 'data-cf-extra-launch-surface'), page.surface);
    assert.equal(attribute(html, 'data-sender-build'), page.rel === 'home/index.html' ? '408-HOME-2.9' : '408-CONV-1.1');
    assert.equal(attribute(html, 'data-handoff-contract'), 'coveragefit-handoff-v1');

    const sharedPrefix = page.rel === 'home/index.html' ? '/shared/' : '../shared/';
    const configIndex = html.indexOf(sharedPrefix + 'config.js');
    const launcherIndex = html.indexOf(sharedPrefix + 'coveragefit-launch.js');
    const profileIndex = html.indexOf(sharedPrefix + 'prospect-profile.js');
    const formIndex = html.indexOf(sharedPrefix + 'script.js');
    assert(configIndex >= 0, 'config script missing');
    assert(launcherIndex > configIndex, 'launcher must load after config');
    assert(profileIndex > launcherIndex, 'profile builder must load after launcher');
    assert(formIndex > profileIndex, 'form behavior must load after profile builder');
  });

  test(`${page.rel} produces a personalized CoverageFit URL`, () => {
    const html = read(page.rel);
    const campaign = hiddenValue(html, 'campaign');
    const source = hiddenValue(html, 'source');
    assert(campaign, 'campaign value missing');
    assert(source, 'source value missing');

    const window = createRuntime('/' + page.rel.replace('/index.html', '/'));
    const profile = window.ProspectProfileBuilder.fromForm(
      fakeForm(campaign, source, 'Current policy renewal')
    );
    const destination = window.CoverageFitLauncher.buildUrl({
      profile,
      campaign: profile.campaign,
      entry: page.entry,
      assessment: 'home',
      extra: {
        launch_surface: page.surface,
        lead_captured: 'true',
        sender_build: '408-CONV-1.1',
        handoff_contract: 'coveragefit-handoff-v1'
      }
    });
    const url = new URL(destination);

    assert.equal(url.origin + url.pathname, 'https://coveragefit.com/home/');
    assert.equal(url.searchParams.get('campaign'), campaign);
    assert.equal(url.searchParams.get('entry'), page.entry);
    assert.equal(url.searchParams.get('launch_surface'), page.surface);
    assert.equal(url.searchParams.get('lead_captured'), 'true');
    assert.equal(url.searchParams.get('sender_build'), '408-CONV-1.1');
    assert.equal(url.searchParams.get('handoff_contract'), 'coveragefit-handoff-v1');
    assert.equal(url.searchParams.get('first_name'), 'Dylan');
    assert.equal(url.searchParams.get('last_name'), 'Haysbert');
    assert.equal(url.searchParams.get('phone'), '4083276377');
    assert.equal(url.searchParams.get('email'), 'dylan@example.com');
    assert.equal(url.searchParams.get('property_address'), '123 Main St, Fremont, CA 94539');
    assert.equal(url.searchParams.get('review_context'), 'Current policy renewal');
    assert.equal(url.searchParams.get('prefill'), '1');
    assert.equal(url.searchParams.get('handoff_version'), '1');
    assert.equal(url.searchParams.get('session_id'), 'handoff-session-123');
  });
}

test('shared form behavior explicitly uses the form campaign during handoff', () => {
  assert(sharedFormCode.includes('const handoffCampaign = prospectProfile && prospectProfile.campaign'));
  assert(sharedFormCode.includes('campaign: handoffCampaign'));
});

test('auto-bundle now participates in the CoverageFit handoff', () => {
  const html = read('auto-bundle/index.html');
  assert(html.includes('data-coveragefit-after-submit="true"'));
  assert(html.includes('data-cf-entry="auto_bundle_form"'));
  assert(html.includes('data-cf-next="/assessment/"'));
});

let failures = 0;
for (const item of tests) {
  try {
    item.fn();
    console.log('PASS', item.name);
  } catch (error) {
    failures += 1;
    console.error('FAIL', item.name, '\n ', error.stack);
  }
}

console.log(`\n${tests.length - failures}/${tests.length} 408-HO-1A tests passed`);
process.exitCode = failures ? 1 : 0;
