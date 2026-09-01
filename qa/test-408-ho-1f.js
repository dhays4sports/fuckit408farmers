#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const sourceOriginal = fs.readFileSync(path.join(root, 'shared/script.js'), 'utf8');

function storage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    has(key) { return map.has(key); }
  };
}

function makeForm() {
  const entries = {
    first_name: 'Dylan',
    last_name: 'Test',
    phone: '(408) 555-1234',
    email: 'dylan@example.com',
    property_address: '833 Corporate Way, Fremont, CA 94539',
    segment: 'Current policy renewal',
    campaign: 'Does Your Insurance Still Fit Your Home',
    source: '408farmers.com/home',
    consent: 'on',
    landing_page: '',
    submitted_at: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: ''
  };
  const listeners = {};
  const label = { textContent: 'Get My Coverage Review' };
  const button = {
    disabled: false,
    querySelector(selector) {
      if (selector === 'span:first-child') return label;
      return null;
    }
  };
  const elements = {};
  for (const [name, value] of Object.entries(entries)) {
    elements[name] = {
      value,
      checked: name === 'consent',
      focusCalled: false,
      focus() { this.focusCalled = true; }
    };
  }
  const form = {
    dataset: {
      coveragefitAfterSubmit: 'true',
      cfEntry: 'home_lander_form',
      cfAssessment: 'home',
      cfNext: '/assessment/',
      cfExtraLaunchSurface: 'home_lander',
      success: 'thank-you.html',
      senderBuild: '408-CONV-1.1',
      handoffContract: 'coveragefit-handoff-v1'
    },
    elements,
    _entries: entries,
    checkValidity() { return true; },
    reportValidity() {},
    addEventListener(type, handler) { listeners[type] = handler; },
    querySelector(selector) {
      if (selector === 'button[type="submit"]') return button;
      const match = selector.match(/^\[name="(.+)"\]$/);
      if (match) return elements[match[1]] || null;
      return null;
    }
  };
  return { form, listeners, label, button, entries };
}

function makeRuntime(fetchImpl, graceMs = 900) {
  const { form, listeners, label, button, entries } = makeForm();
  const formStatus = { textContent: '' };
  const launched = [];
  const fetchCalls = [];
  const sessionStorage = storage();
  const location = {
    hash: '',
    search: '',
    href: 'https://408farmers.com/home/',
    pathname: '/home/',
    origin: 'https://408farmers.com'
  };
  const window = {
    location,
    LANDING_PAGE_CONFIG: { formEndpoint: 'https://formspree.io/f/test' },
    ProspectProfileBuilder: {
      fromForm() {
        return {
          firstName: 'Dylan',
          lastName: 'Test',
          phone: '(408) 555-1234',
          email: 'dylan@example.com',
          propertyAddress: '833 Corporate Way, Fremont, CA 94539',
          reviewContext: 'Current policy renewal',
          campaign: 'Does Your Insurance Still Fit Your Home'
        };
      },
      save() {}
    },
    CoverageFitLauncher: {
      launch(options) { launched.push(options); }
    },
    addEventListener() {},
    scrollTo() {}
  };
  const document = {
    getElementById(id) {
      if (id === 'leadForm') return form;
      if (id === 'formStatus') return formStatus;
      return null;
    }
  };
  class FormDataMock {
    constructor(inputForm) {
      this.values = { ...inputForm._entries };
    }
    *entries() {
      yield* Object.entries(this.values);
    }
  }
  const wrappedFetch = async (...args) => {
    fetchCalls.push(args);
    return fetchImpl(...args);
  };
  const source = sourceOriginal.replace(
    "const LEAD_SUBMISSION_GRACE_MS = 900;",
    `const LEAD_SUBMISSION_GRACE_MS = ${graceMs};`
  );
  const context = vm.createContext({
    window,
    document,
    history: { scrollRestoration: 'auto' },
    location,
    sessionStorage,
    fetch: wrappedFetch,
    FormData: FormDataMock,
    URLSearchParams,
    Object,
    JSON,
    Date,
    Promise,
    Error,
    setTimeout,
    clearTimeout,
    console
  });
  vm.runInContext(source, context);
  return {
    form,
    listeners,
    label,
    button,
    entries,
    launched,
    fetchCalls,
    sessionStorage,
    formStatus
  };
}

async function submit(env) {
  assert.equal(typeof env.listeners.submit, 'function');
  await env.listeners.submit({ preventDefault() {} });
}

async function main() {
  {
    const env = makeRuntime(async () => ({ ok: true }));
    await submit(env);
    assert.equal(env.launched.length, 1);
    assert.equal(env.launched[0].extra.lead_capture_status, 'confirmed');
    assert.equal(env.launched[0].extra.lead_captured, 'true');
    assert.equal(env.launched[0].next, '/assessment/');
    assert.equal(env.launched[0].extra.sender_build, '408-CONV-1.1');
    assert.equal(env.launched[0].extra.handoff_version, '1.1');
    assert.equal(env.launched[0].extra.contact_consent, 'true');
    assert.equal(env.launched[0].extra.consent_version, '408farmers-contact-v1');
    assert.match(env.launched[0].extra.consent_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(env.launched[0].extra.submitted_at, env.launched[0].extra.consent_at);
    assert.equal(env.fetchCalls.length, 1);
    assert.equal(env.fetchCalls[0][1].keepalive, true);
    assert.equal(env.label.textContent, 'Opening CoverageFit…');
    console.log('PASS successful Formspree response opens CoverageFit');
  }

  {
    const env = makeRuntime(async () => ({ ok: false }));
    await submit(env);
    assert.equal(env.launched.length, 1);
    assert.equal(env.launched[0].extra.lead_capture_status, 'unconfirmed');
    assert.equal(env.launched[0].extra.lead_captured, 'pending');
    assert.equal(env.button.disabled, true);
    assert.equal(env.formStatus.textContent, '');
    console.log('PASS rejected Formspree response no longer blocks CoverageFit');
  }

  {
    const env = makeRuntime(() => new Promise(() => {}), 0);
    await submit(env);
    assert.equal(env.launched.length, 1);
    assert.equal(env.launched[0].extra.lead_capture_status, 'pending');
    assert.equal(env.launched[0].extra.lead_captured, 'pending');
    assert.equal(env.fetchCalls[0][1].keepalive, true);
    assert.equal(env.sessionStorage.has('408farmersLeadPending'), true);
    console.log('PASS slow Formspree response opens CoverageFit after bounded grace period');
  }

  console.log('\n408-CONV-1.1 runtime QA: 3/3 passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
