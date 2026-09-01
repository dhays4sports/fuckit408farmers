#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../shared/script.js'), 'utf8');

function makeRuntime({ endpoint = 'https://formspree.io/f/test' } = {}) {
  const listeners = {};
  const engagementCalls = [];
  const confirmations = [];
  const launches = [];
  const profiles = [];
  let fetchCount = 0;
  const label = { textContent: 'Continue My Coverage Review' };
  const button = { disabled: false, querySelector: () => label };
  const values = {
    first_name: 'Test', last_name: 'Prospect', phone: '(408) 555-0100', email: 'test@example.com',
    property_address: '833 Corporate Way, Fremont, CA 94539', review_context: 'Comparing coverage',
    home_review_goal: '', housing_context: '', review_timing: '',
    campaign: 'home', source: '408farmers.com/home', consent: 'on', landing_page: '', submitted_at: ''
  };
  const elements = {};
  Object.entries(values).forEach(([name, value]) => {
    elements[name] = { value, checked: name === 'consent', focus() {} };
  });
  const form = {
    dataset: {
      homeJourney: 'true', homeConfirmation: 'true', postLeadEngagement: 'true',
      coveragefitAfterSubmit: 'true', cfEntry: 'home_lander_form', cfAssessment: 'home',
      cfNext: '/assessment/', cfExtraLaunchSurface: 'home_lander', cfBranchField: 'housing_context',
      cfRenterDestination: '/contact/?intent=renters', senderBuild: '408-HOME-2.9',
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
    LANDING_PAGE_CONFIG: { formEndpoint: endpoint },
    ProspectProfileBuilder: {
      fromForm() {
        const profile = {
          campaign: values.campaign,
          propertyAddress: values.property_address,
          homeReviewGoal: elements.home_review_goal.value,
          housingContext: elements.housing_context.value,
          reviewTiming: elements.review_timing.value
        };
        profiles.push(profile);
        return profile;
      },
      save() {}
    },
    CoverageFitLauncher: { launch(options) { launches.push(options); } },
    PostLeadEngagement: { present(options) { engagementCalls.push(options); return true; } },
    HomeLeadConfirmation: { show(options) { confirmations.push(options); return true; } },
    HomeJourneyContract: {
      EVENTS: {
        LEAD_SUBMISSION_ATTEMPTED: 'attempted', LEAD_SUBMISSION_CONFIRMED: 'confirmed',
        LEAD_SUBMISSION_PENDING: 'pending', LEAD_SUBMISSION_UNCONFIRMED: 'unconfirmed',
        COVERAGEFIT_LAUNCHED: 'launched'
      },
      STAGES: { LEAD_CAPTURE: 'lead_capture', CONFIRMATION: 'confirmation', COVERAGEFIT_HANDOFF: 'coveragefit_handoff' }
    },
    HomeJourneyBaseline: { emit() {} },
    dataLayer: [], addEventListener() {}, scrollTo() {}
  };
  const document = {
    getElementById: id => id === 'leadForm' ? form : id === 'formStatus' ? { textContent: '' } : null
  };
  class FormDataMock {
    constructor() {}
    *entries() { yield* Object.entries(values); }
  }
  vm.runInNewContext(source, {
    window, document, location, history: {}, sessionStorage, FormData: FormDataMock, URLSearchParams,
    fetch: async () => { fetchCount += 1; return { ok: true }; }, setTimeout, clearTimeout,
    Date, Promise, Object, JSON, Error, console
  });
  return { listeners, engagementCalls, confirmations, launches, profiles, elements, location, fetchCount: () => fetchCount };
}

async function submit(runtime) {
  await runtime.listeners.submit({ preventDefault() {} });
}

(async function () {
  const homeowner = makeRuntime();
  await submit(homeowner);
  assert.equal(homeowner.fetchCount(), 1, 'the lead is submitted once before engagement');
  assert.equal(homeowner.engagementCalls.length, 1, 'post-lead engagement is presented once');
  assert.equal(homeowner.engagementCalls[0].leadCaptureStatus, 'confirmed');
  assert.equal(homeowner.confirmations.length, 0, 'legacy automatic confirmation is bypassed');
  assert.equal(homeowner.launches.length, 0, 'CoverageFit does not launch without the prospect choice');

  homeowner.elements.home_review_goal.value = 'coverage_fit';
  homeowner.elements.housing_context.value = 'owner_occupied';
  homeowner.elements.review_timing.value = 'renewal_60';
  homeowner.engagementCalls[0].onContinue();
  assert.equal(homeowner.fetchCount(), 1, 'continuing does not submit another lead');
  assert.equal(homeowner.launches.length, 1, 'the explicit choice launches CoverageFit once');
  assert.equal(homeowner.launches[0].profile.homeReviewGoal, 'coverage_fit');
  assert.equal(homeowner.launches[0].profile.housingContext, 'owner_occupied');
  assert.equal(homeowner.launches[0].profile.reviewTiming, 'renewal_60');
  assert.equal(homeowner.profiles.length, 2, 'the profile is rebuilt after the post-lead answers');
  console.log('PASS confirmed lead waits for post-lead payoff and opted-in CoverageFit continuation');

  const deferred = makeRuntime();
  await submit(deferred);
  assert.equal(deferred.launches.length, 0, 'deferring leaves the captured lead without an automatic launch');
  assert.equal(deferred.fetchCount(), 1);
  console.log('PASS deferred continuation preserves the first lead without a second request');

  const renter = makeRuntime();
  await submit(renter);
  renter.elements.home_review_goal.value = 'exploring';
  renter.elements.housing_context.value = 'renter';
  renter.elements.review_timing.value = 'not_sure';
  renter.engagementCalls[0].onContinue();
  assert.equal(renter.location.href, '/contact/?intent=renters');
  assert.equal(renter.launches.length, 0, 'renter does not enter the homeowner assessment');
  assert.equal(renter.fetchCount(), 1);
  console.log('PASS renter choice resolves after engagement without another lead submission');

  const fallback = makeRuntime({ endpoint: '' });
  await submit(fallback);
  assert.equal(fallback.fetchCount(), 0);
  assert.equal(fallback.engagementCalls[0].leadCaptureStatus, 'local-fallback');
  assert.equal(fallback.launches.length, 0);
  console.log('PASS local fallback uses truthful receipt copy and still requires a continuation choice');

  console.log('408-FLOW-2.3 runtime QA: 4/4 passed');
})().catch(error => { console.error(error); process.exit(1); });
