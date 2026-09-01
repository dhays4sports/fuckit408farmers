#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../shared/script.js'), 'utf8');

function makeRuntime({ renter = false } = {}) {
  const listeners = {};
  const launched = [];
  const confirmations = [];
  const journeyEvents = [];
  const label = { textContent: 'Continue to My Coverage Review' };
  const button = { disabled: false, querySelector: () => label };
  const values = {
    first_name: 'Test', last_name: 'Homeowner', phone: '(408) 555-0100', email: 'test@example.com',
    property_address: renter ? '' : '833 Corporate Way, Fremont, CA 94539',
    housing_context: renter ? 'renter' : 'owner_occupied', review_context: renter ? 'Need a new policy' : 'Comparing coverage',
    campaign: 'home', source: '408farmers.com/home', consent: 'on', landing_page: '', submitted_at: ''
  };
  const elements = {};
  Object.entries(values).forEach(([name, value]) => {
    elements[name] = { value, checked: name === 'consent', focus() {} };
  });
  const form = {
    dataset: {
      homeJourney: 'true', homeConfirmation: 'true', coveragefitAfterSubmit: 'true',
      cfEntry: 'home_lander_form', cfAssessment: 'home', cfNext: '/assessment/',
      cfExtraLaunchSurface: 'home_lander', cfBranchField: 'housing_context',
      cfRenterDestination: '/contact/?intent=renters', senderBuild: '408-HOME-2.5',
      handoffContract: 'coveragefit-handoff-v1', success: 'thank-you.html'
    },
    elements,
    _values: values,
    checkValidity: () => true,
    reportValidity() {},
    addEventListener(type, handler) { listeners[type] = handler; },
    querySelector(selector) {
      if (selector === 'button[type="submit"]') return button;
      const match = selector.match(/^\[name="(.+)"\]$/);
      return match ? elements[match[1]] : null;
    }
  };
  const location = { search: '', hash: '', href: 'https://408farmers.com/home/' };
  const sessionStorage = { setItem() {}, removeItem() {} };
  const window = {
    location,
    LANDING_PAGE_CONFIG: { formEndpoint: 'https://formspree.io/f/test' },
    ProspectProfileBuilder: {
      fromForm: () => ({ campaign: 'home', propertyAddress: values.property_address }),
      save() {}
    },
    CoverageFitLauncher: { launch(options) { launched.push(options); } },
    HomeJourneyContract: {
      EVENTS: {
        LEAD_SUBMISSION_ATTEMPTED: 'attempted', LEAD_SUBMISSION_CONFIRMED: 'confirmed',
        LEAD_SUBMISSION_PENDING: 'pending', LEAD_SUBMISSION_UNCONFIRMED: 'unconfirmed',
        COVERAGEFIT_LAUNCHED: 'launched'
      },
      STAGES: { LEAD_CAPTURE: 'lead_capture', CONFIRMATION: 'confirmation', COVERAGEFIT_HANDOFF: 'coveragefit_handoff' }
    },
    HomeJourneyBaseline: { emit(name, properties) { journeyEvents.push({ name, properties }); } },
    HomeLeadConfirmation: {
      show(options) { confirmations.push(options); return true; }
    },
    dataLayer: [], addEventListener() {}, scrollTo() {}
  };
  const document = { getElementById: id => id === 'leadForm' ? form : id === 'formStatus' ? { textContent: '' } : null };
  class FormDataMock {
    constructor(input) { this.values = input._values; }
    *entries() { yield* Object.entries(this.values); }
  }
  vm.runInNewContext(source, {
    window, document, location, history: {}, sessionStorage, FormData: FormDataMock,
    URLSearchParams, fetch: async () => ({ ok: true }), setTimeout, clearTimeout,
    Date, Promise, Object, JSON, Error, console
  });
  return { listeners, launched, confirmations, journeyEvents, location, window };
}

async function submit(runtime) {
  await runtime.listeners.submit({ preventDefault() {} });
}

(async function () {
  const homeowner = makeRuntime();
  await submit(homeowner);
  assert.equal(homeowner.confirmations.length, 1);
  assert.equal(homeowner.confirmations[0].leadCaptureStatus, 'confirmed');
  assert.equal(homeowner.confirmations[0].destinationType, 'coveragefit');
  assert.equal(homeowner.launched.length, 0, 'launch waits for the visible confirmation');
  assert.deepEqual(homeowner.journeyEvents.map(item => item.name), ['attempted', 'confirmed']);
  homeowner.confirmations[0].onContinue();
  assert.equal(homeowner.launched.length, 1);
  assert.equal(homeowner.launched[0].next, '/assessment/');
  assert.equal(homeowner.launched[0].extra.sender_build, '408-HOME-2.5');
  assert.deepEqual(homeowner.journeyEvents.map(item => item.name), ['attempted', 'confirmed', 'launched']);
  console.log('PASS homeowner waits for confirmation, then launches CoverageFit once');

  const renter = makeRuntime({ renter: true });
  await submit(renter);
  assert.equal(renter.confirmations[0].destinationType, 'renters');
  assert.equal(renter.launched.length, 0);
  renter.confirmations[0].onContinue();
  assert.equal(renter.location.href, '/contact/?intent=renters');
  assert.equal(renter.launched.length, 0);
  assert.equal(renter.window.dataLayer.at(-1).event, 'renters_direct_review_handoff');
  console.log('PASS renter waits for confirmation, then keeps the direct renters route');

  console.log('408-HOME-2.5 runtime QA: 2/2 passed');
})().catch(error => { console.error(error); process.exit(1); });
