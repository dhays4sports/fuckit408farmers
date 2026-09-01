#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../shared/script.js'), 'utf8');

function runtime({ postLead = true, invitation = true, renter = false } = {}) {
  const listeners = {};
  const buttonListeners = {};
  const postLeadCalls = [];
  const invitationCalls = [];
  const confirmations = [];
  const launches = [];
  let fetchCount = 0;
  const label = { textContent: 'Continue My Coverage Review' };
  const button = {
    disabled: false, type: 'submit',
    querySelector: () => label,
    addEventListener(type, handler) { buttonListeners[type] = handler; }
  };
  const values = {
    first_name: 'Test', last_name: 'Prospect', phone: '(408) 555-0100', email: 'test@example.com',
    property_address: renter ? '' : '833 Corporate Way, Fremont, CA', review_context: 'Comparing coverage',
    home_review_goal: 'coverage_fit', housing_context: renter ? 'renter' : 'owner_occupied', review_timing: 'shopping_now',
    campaign: 'home', source: '408farmers.com/home', consent: 'on', landing_page: '', submitted_at: ''
  };
  const elements = {};
  Object.entries(values).forEach(([name, value]) => { elements[name] = { value, checked: name === 'consent', focus() {} }; });
  const form = {
    dataset: {
      homeJourney: 'true', homeConfirmation: 'true', postLeadEngagement: 'true', coveragefitInvitation: 'true',
      coveragefitAfterSubmit: 'true', cfEntry: 'home_lander_form', cfAssessment: 'home', cfNext: '/assessment/',
      cfExtraLaunchSurface: 'home_lander', cfBranchField: 'housing_context', cfRenterDestination: '/contact/?intent=renters',
      senderBuild: '408-HOME-2.9', handoffContract: 'coveragefit-handoff-v1', success: 'thank-you.html'
    },
    elements, _values: values,
    checkValidity: () => true, reportValidity() {},
    addEventListener(type, handler) { listeners[type] = handler; },
    querySelector(selector) {
      if (selector === 'button[type="submit"]') return button;
      const match = selector.match(/^\[name="(.+)"\]$/);
      return match ? elements[match[1]] : null;
    }
  };
  const status = { textContent: '' };
  const location = { search: '', hash: '', href: 'https://408farmers.com/home/' };
  const window = {
    location, LANDING_PAGE_CONFIG: { formEndpoint: 'https://formspree.io/f/test' },
    ProspectProfileBuilder: { fromForm: () => ({ campaign: 'home', housingContext: elements.housing_context.value }), save() {} },
    CoverageFitLauncher: { launch(options) { launches.push(options); } },
    HomeLeadConfirmation: { show(options) { confirmations.push(options); return true; } },
    HomeJourneyContract: {
      EVENTS: { LEAD_SUBMISSION_ATTEMPTED:'attempted', LEAD_SUBMISSION_CONFIRMED:'confirmed', LEAD_SUBMISSION_PENDING:'pending', LEAD_SUBMISSION_UNCONFIRMED:'unconfirmed', COVERAGEFIT_LAUNCHED:'launched' },
      STAGES: { LEAD_CAPTURE:'lead_capture', CONFIRMATION:'confirmation', COVERAGEFIT_HANDOFF:'coveragefit_handoff' }
    },
    HomeJourneyBaseline: { emit() {} }, dataLayer: [], addEventListener() {}, scrollTo() {}
  };
  if (postLead) window.PostLeadEngagement = { present(options) { postLeadCalls.push(options); return true; } };
  if (invitation) window.CoverageFitInvitation = { present(options) { invitationCalls.push(options); return true; } };
  const document = { getElementById: id => id === 'leadForm' ? form : id === 'formStatus' ? status : null };
  class FormDataMock { *entries() { yield* Object.entries(values); } }
  vm.runInNewContext(source, {
    window, document, location, history:{}, sessionStorage:{ setItem(){}, removeItem(){} }, FormData:FormDataMock, URLSearchParams,
    fetch: async () => { fetchCount += 1; return { ok:true }; }, setTimeout, clearTimeout, Date, Promise, Object, JSON, Error, console
  });
  return { listeners, buttonListeners, button, label, status, postLeadCalls, invitationCalls, confirmations, launches, location, fetchCount: () => fetchCount };
}

async function submit(r) { await r.listeners.submit({ preventDefault() {} }); }

(async function () {
  const normal = runtime();
  await submit(normal);
  assert.equal(normal.fetchCount(), 1);
  assert.equal(normal.postLeadCalls.length, 1);
  assert.equal(normal.invitationCalls.length, 0, 'invitation waits until after the FLOW-2.3 payoff');
  assert.equal(normal.launches.length, 0);
  assert.equal(normal.confirmations.length, 0);
  console.log('PASS normal journey waits at post-lead engagement with no automatic launch');

  const directInvitation = runtime({ postLead:false });
  await submit(directInvitation);
  assert.equal(directInvitation.invitationCalls.length, 1, 'missing engagement safely falls through to the optional invitation');
  assert.equal(directInvitation.launches.length, 0);
  assert.equal(directInvitation.confirmations.length, 0);
  directInvitation.invitationCalls[0].onContinue();
  assert.equal(directInvitation.launches.length, 1, 'only invitation acceptance launches CoverageFit');
  assert.equal(directInvitation.fetchCount(), 1, 'acceptance creates no second lead request');
  console.log('PASS direct invitation fallback launches only after explicit acceptance');

  const deferred = runtime({ postLead:false });
  await submit(deferred);
  assert.equal(deferred.launches.length, 0);
  assert.equal(deferred.fetchCount(), 1);
  console.log('PASS leaving the invitation untouched preserves the lead without redirecting');

  const degraded = runtime({ postLead:false, invitation:false });
  await submit(degraded);
  assert.equal(degraded.launches.length, 0);
  assert.equal(degraded.confirmations.length, 0, 'legacy timed confirmation is not restored');
  assert.equal(degraded.button.type, 'button');
  assert.match(degraded.label.textContent, /Optional/);
  assert.match(degraded.status.textContent, /CoverageFit is optional/);
  degraded.buttonListeners.click();
  assert.equal(degraded.launches.length, 1, 'degraded mode still requires a fresh click');
  assert.equal(degraded.fetchCount(), 1);
  console.log('PASS dual-controller failure remains non-automatic and click-gated');

  const renter = runtime({ postLead:false, renter:true });
  await submit(renter);
  assert.equal(renter.invitationCalls[0].destinationType, 'renters');
  assert.equal(renter.launches.length, 0);
  renter.invitationCalls[0].onContinue();
  assert.equal(renter.location.href, '/contact/?intent=renters');
  assert.equal(renter.launches.length, 0);
  console.log('PASS renter invitation accepts into renter options, not CoverageFit Home');

  console.log('408-FLOW-2.4 runtime QA: 5/5 passed');
})().catch(error => { console.error(error); process.exit(1); });
