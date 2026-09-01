'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const landing = read('teachers/index.html');
const thanks = read('teachers/thank-you.html');
const launcherCode = read('shared/coveragefit-launch.js');
const profileCode = read('shared/prospect-profile.js');

function storage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function createRuntime() {
  const window = {
    location: {
      origin: 'https://408farmers.com',
      pathname: '/teachers/',
      search: '?utm_source=school-newsletter&utm_campaign=educator-review',
      assign() {}
    },
    sessionStorage: storage(),
    localStorage: storage(),
    crypto: { randomUUID: () => 'teachers-session-123' },
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

function form() {
  const values = {
    first_name: 'Jamie',
    last_name: 'Teacher',
    phone: '(408) 555-0188',
    email: 'JAMIE@EXAMPLE.COM',
    property_address: '456 Schoolhouse Ave, San Jose, CA 95124',
    property_formatted_address: '',
    property_street: '',
    property_city: '',
    property_county: '',
    property_state: '',
    property_zip: '',
    property_country: '',
    property_place_id: '',
    address_selection_method: '',
    review_context: 'Professional eligibility and home coverage review',
    occupation_segment: 'Teacher or instructor',
    housing_context: '',
    campaign: 'Teachers and School Employees',
    source: '408farmers.com/teachers',
    utm_source: 'school-newsletter',
    utm_medium: 'email',
    utm_campaign: 'educator-review',
    utm_content: '',
    utm_term: ''
  };
  const elements = {};
  Object.keys(values).forEach(key => { elements[key] = { value: values[key] }; });
  return { elements };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('teachers landing page is a complete public campaign page', () => {
  assert(landing.length > 5000);
  assert(landing.includes('<title>Teacher &amp; School Employee Discount Review | 408-FARMERS</title>'));
  assert(landing.includes('../shared/assets/teachers.png'));
  assert(landing.includes('Work in Education?'));
  assert(landing.includes('Teachers and school employees'));
});

test('teachers form uses the production handoff contract', () => {
  assert(landing.includes('id="leadForm"'));
  assert(landing.includes('data-coveragefit-after-submit="true"'));
  assert(landing.includes('data-cf-entry="teachers_eligibility_form"'));
  assert(landing.includes('data-cf-assessment="home"'));
  assert(landing.includes('data-cf-extra-launch-surface="occupation_education"'));
  assert(landing.includes('data-success="thank-you.html"'));
  assert(landing.includes('data-sender-build="408-CONV-1.1"'));
  assert(landing.includes('data-handoff-contract="coveragefit-handoff-v1"'));
  assert(landing.includes('name="408farmers-handoff-build"'));
  assert(landing.includes('name="source" type="hidden" value="408farmers.com/teachers"'));
  assert(landing.includes('name="campaign" type="hidden" value="Teachers and School Employees"'));
});

test('teachers form collects the canonical profile fields and educator context', () => {
  for (const field of ['first_name', 'last_name', 'phone', 'email', 'property_address', 'occupation_segment', 'review_context', 'consent']) {
    assert(landing.includes(`name="${field}"`), `${field} missing`);
  }
  assert(landing.includes('Teacher or instructor'));
  assert(landing.includes('School administrator'));
  assert(landing.includes('College or university employee'));
});

test('teachers page loads shared scripts in the canonical order', () => {
  const config = landing.indexOf('../shared/config.js');
  const launcher = landing.indexOf('../shared/coveragefit-launch.js');
  const profile = landing.indexOf('../shared/prospect-profile.js');
  const behavior = landing.indexOf('../shared/script.js');
  assert(config >= 0);
  assert(launcher > config);
  assert(profile > launcher);
  assert(behavior > profile);
});

test('teachers profile creates a personalized CoverageFit handoff URL', () => {
  const window = createRuntime();
  const profile = window.ProspectProfileBuilder.fromForm(form());
  const destination = window.CoverageFitLauncher.buildUrl({
    profile,
    campaign: profile.campaign,
    entry: 'teachers_eligibility_form',
    assessment: 'home',
    extra: {
      launch_surface: 'occupation_education',
      lead_captured: 'true',
      sender_build: '408-CONV-1.1',
      handoff_contract: 'coveragefit-handoff-v1'
    }
  });
  const url = new URL(destination);

  assert.equal(url.origin + url.pathname, 'https://coveragefit.com/home/');
  assert.equal(url.searchParams.get('first_name'), 'Jamie');
  assert.equal(url.searchParams.get('last_name'), 'Teacher');
  assert.equal(url.searchParams.get('phone'), '4085550188');
  assert.equal(url.searchParams.get('email'), 'jamie@example.com');
  assert.equal(url.searchParams.get('property_address'), '456 Schoolhouse Ave, San Jose, CA 95124');
  assert.equal(url.searchParams.get('occupation_segment'), 'Teacher or instructor');
  assert.equal(url.searchParams.get('review_context'), 'Professional eligibility and home coverage review');
  assert.equal(url.searchParams.get('campaign'), 'Teachers and School Employees');
  assert.equal(url.searchParams.get('entry'), 'teachers_eligibility_form');
  assert.equal(url.searchParams.get('launch_surface'), 'occupation_education');
  assert.equal(url.searchParams.get('lead_captured'), 'true');
  assert.equal(url.searchParams.get('sender_build'), '408-CONV-1.1');
  assert.equal(url.searchParams.get('handoff_contract'), 'coveragefit-handoff-v1');
  assert.equal(url.searchParams.get('prefill'), '1');
  assert.equal(url.searchParams.get('handoff_version'), '1');
  assert.equal(url.searchParams.get('session_id'), 'teachers-session-123');
});

test('teachers fallback page is complete and actionable', () => {
  assert(thanks.length > 1500);
  assert(thanks.includes('Request received'));
  assert(thanks.includes('What happens next'));
  assert(thanks.includes('sms:+14083276377'));
  assert(thanks.includes('tel:+14083276377'));
  assert(thanks.includes('href="/teachers"'));
  assert(thanks.includes('../privacy.html'));
  assert(thanks.includes('../terms.html'));
});

test('homepage continues to expose the restored Teachers route', () => {
  const home = read('index.html');
  assert(home.includes('href="teachers/"'));
  assert(home.includes('Teachers and school employees'));
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

console.log(`\n${tests.length - failures}/${tests.length} 408-HO-1B tests passed`);
process.exitCode = failures ? 1 : 0;
