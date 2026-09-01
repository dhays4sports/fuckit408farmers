'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');
const flush = () => new Promise(resolve => setImmediate(resolve));

const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'shared/address-autocomplete.js'), 'utf8');

class EventTargetMock {
  constructor() { this.listeners = {}; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatchEvent(event) {
    event.target ||= this;
    event.preventDefault ||= function() { this.defaultPrevented = true; };
    for (const fn of this.listeners[event.type] || []) fn.call(this, event);
    return !event.defaultPrevented;
  }
}

class ElementMock extends EventTargetMock {
  constructor(tag = 'div') {
    super();
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.hidden = false;
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.id = '';
    this.type = '';
    this.parentNode = null;
    this._classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => this._classes.add(name)),
      toggle: (name, force) => {
        if (force === true) this._classes.add(name);
        else if (force === false) this._classes.delete(name);
        else if (this._classes.has(name)) this._classes.delete(name);
        else this._classes.add(name);
      },
      contains: name => this._classes.has(name)
    };
  }
  appendChild(node) { node.parentNode = this; this.children.push(node); return node; }
  replaceChildren(...nodes) { this.children = []; nodes.forEach(node => this.appendChild(node)); }
  setAttribute(key, value) { this.attributes[key] = String(value); if (key === 'id') this.id = String(value); }
  removeAttribute(key) { delete this.attributes[key]; }
  contains(target) {
    if (target === this) return true;
    return this.children.some(child => child.contains?.(target));
  }
  querySelectorAll(selector) {
    const matches = [];
    const visit = node => {
      if (selector === '[role="option"]' && node.attributes?.role === 'option') matches.push(node);
      for (const child of node.children || []) visit(child);
    };
    visit(this);
    return matches;
  }
  scrollIntoView() {}
}

function makePrediction(text, placeData) {
  return {
    text: { toString: () => text },
    toPlace() {
      return {
        ...placeData,
        async fetchFields() {}
      };
    }
  };
}

function makePlacesGoogle({ suggestions = [] } = {}) {
  class AutocompleteSessionToken {}
  class AutocompleteSuggestion {
    static requests = [];
    static async fetchAutocompleteSuggestions(request) {
      AutocompleteSuggestion.requests.push(request);
      return { suggestions: suggestions.map(placePrediction => ({ placePrediction })) };
    }
  }
  return {
    google: {
      maps: {
        async importLibrary(name) {
          assert.equal(name, 'places');
          return { AutocompleteSessionToken, AutocompleteSuggestion };
        }
      }
    },
    AutocompleteSuggestion
  };
}

function makeEnv({ apiKey = '', google = null } = {}) {
  const form = new ElementMock('form');
  const hiddenNames = [
    'property_formatted_address','property_street','property_city','property_county',
    'property_state','property_zip','property_country','property_place_id','address_selection_method'
  ];
  const hidden = Object.fromEntries(hiddenNames.map(name => [name, { name, value: name === 'address_selection_method' ? 'manual' : '' }]));
  form.querySelector = selector => {
    const match = selector.match(/\[name="([^"]+)"\]/);
    return match ? hidden[match[1]] || null : null;
  };

  const label = new ElementMock('label');
  const input = new ElementMock('input');
  input.id = 'property-address';
  input.closest = selector => selector === 'form' ? form : selector === 'label' ? label : null;
  input.blur = () => {};
  input.focus = () => {};

  const document = new EventTargetMock();
  document.documentElement = new ElementMock('html');
  document.head = new ElementMock('head');
  document.querySelector = selector => {
    if (selector === '[data-address-autocomplete="property"]') return input;
    if (selector === 'script[data-google-places-loader]') return null;
    return null;
  };
  document.createElement = tag => new ElementMock(tag);

  let nextTimerId = 1;
  const timers = new Map();
  const window = {
    LANDING_PAGE_CONFIG: { googlePlacesApiKey: apiKey },
    google,
    setTimeout(fn, delay = 0) { const id = nextTimerId++; timers.set(id, { fn, delay, cleared: false }); return id; },
    clearTimeout(id) { const timer = timers.get(id); if (timer) timer.cleared = true; },
    CustomEvent: function(type, init = {}) { this.type = type; this.detail = init.detail; this.bubbles = init.bubbles; }
  };
  const context = vm.createContext({
    window, document, console,
    CustomEvent: window.CustomEvent,
    Event: function(type, init = {}) { this.type = type; this.bubbles = init.bubbles; },
    Object, Array, String, Promise
  });
  vm.runInContext(code, context);

  const runTimers = async delay => {
    const pending = [...timers.values()].filter(timer => !timer.cleared && (delay === undefined || timer.delay === delay));
    pending.forEach(timer => { timer.cleared = true; timer.fn(); });
    await flush();
  };

  const suggestionList = label.children.find(child => child.className === 'address-suggestion-list');
  const helper = label.children.find(child => child.className === 'address-autocomplete-helper');
  return { window, document, form, input, hidden, label, suggestionList, helper, runTimers };
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('blank API key preserves manual entry and helper guidance', async () => {
  const env = makeEnv();
  assert.equal(env.input.dataset.addressAutocompleteState, 'manual');
  assert.equal(env.document.documentElement.dataset.addressAutocompleteState, 'manual');
  assert.ok(env.helper.textContent.includes('manually'));
});

test('native address input remains editable and browser autofill is disabled', async () => {
  const env = makeEnv();
  assert.equal(env.input.attributes.autocomplete, 'off');
  assert.equal(env.input.attributes.role, 'combobox');
  env.input.value = '22';
  const event = { type: 'input' };
  env.input.dispatchEvent(event);
  assert.equal(env.input.value, '22');
  assert.equal(event.defaultPrevented, undefined);
});

test('two characters never trigger a Google request and three characters do', async () => {
  const prediction = makePrediction('2255 Main St, Fremont, CA', {});
  const places = makePlacesGoogle({ suggestions: [prediction] });
  const env = makeEnv({ google: places.google });
  await flush();

  env.input.value = '22';
  env.input.dispatchEvent({ type: 'input' });
  await env.runTimers(220);
  assert.equal(places.AutocompleteSuggestion.requests.length, 0);
  assert.equal(env.input.value, '22');

  env.input.value = '225';
  env.input.dispatchEvent({ type: 'input' });
  await env.runTimers(220);
  assert.equal(places.AutocompleteSuggestion.requests.length, 1);
  assert.equal(places.AutocompleteSuggestion.requests[0].input, '225');
  assert.deepEqual(places.AutocompleteSuggestion.requests[0].includedRegionCodes, ['us']);
});

test('new Places API renders up to five accessible suggestions', async () => {
  const predictions = Array.from({ length: 6 }, (_, index) => makePrediction(`${index} Main St, Fremont, CA`, {}));
  const places = makePlacesGoogle({ suggestions: predictions });
  const env = makeEnv({ google: places.google });
  await flush();
  env.input.value = '123';
  env.input.dispatchEvent({ type: 'input' });
  await env.runTimers(220);
  const options = env.suggestionList.querySelectorAll('[role="option"]');
  assert.equal(options.length, 5);
  assert.equal(env.suggestionList.hidden, false);
  assert.equal(env.input.attributes['aria-expanded'], 'true');
});

test('selected suggestion stores formatted and structured address', async () => {
  const placeData = {
    formattedAddress: '405 Mission Peak Dr, Fremont, CA 94539, USA',
    id: 'place-123',
    addressComponents: [
      { longText: '405', shortText: '405', types: ['street_number'] },
      { longText: 'Mission Peak Drive', shortText: 'Mission Peak Dr', types: ['route'] },
      { longText: 'Fremont', shortText: 'Fremont', types: ['locality'] },
      { longText: 'Alameda County', shortText: 'Alameda County', types: ['administrative_area_level_2'] },
      { longText: 'California', shortText: 'CA', types: ['administrative_area_level_1'] },
      { longText: '94539', shortText: '94539', types: ['postal_code'] },
      { longText: 'United States', shortText: 'US', types: ['country'] }
    ]
  };
  const prediction = makePrediction(placeData.formattedAddress, placeData);
  const places = makePlacesGoogle({ suggestions: [prediction] });
  const env = makeEnv({ google: places.google });
  await flush();
  env.input.value = '405';
  env.input.dispatchEvent({ type: 'input' });
  await env.runTimers(220);
  const option = env.suggestionList.querySelectorAll('[role="option"]')[0];
  option.dispatchEvent({ type: 'click' });
  await flush();
  assert.equal(env.input.value, placeData.formattedAddress);
  assert.equal(env.hidden.property_street.value, '405 Mission Peak Drive');
  assert.equal(env.hidden.property_city.value, 'Fremont');
  assert.equal(env.hidden.property_state.value, 'CA');
  assert.equal(env.hidden.property_zip.value, '94539');
  assert.equal(env.hidden.property_place_id.value, 'place-123');
  assert.equal(env.hidden.address_selection_method.value, 'autocomplete');
});

test('editing a selected address clears stale structured values', async () => {
  const prediction = makePrediction('100 First St, Fremont, CA', {
    formattedAddress: '100 First St, Fremont, CA', id: 'x', addressComponents: []
  });
  const places = makePlacesGoogle({ suggestions: [prediction] });
  const env = makeEnv({ google: places.google });
  await flush();
  env.input.value = '100';
  env.input.dispatchEvent({ type: 'input' });
  await env.runTimers(220);
  env.suggestionList.querySelectorAll('[role="option"]')[0].dispatchEvent({ type: 'click' });
  await flush();
  env.input.value = '100 First Street Unit 2, Fremont, CA';
  env.input.dispatchEvent({ type: 'input' });
  assert.equal(env.hidden.property_place_id.value, '');
  assert.equal(env.hidden.address_selection_method.value, 'manual');
});

test('typed manual address synchronizes canonical fields on submit', async () => {
  const env = makeEnv();
  env.input.value = '833 Corporate Way, Fremont, CA 94539';
  env.form.dispatchEvent({ type: 'submit' });
  assert.equal(env.hidden.property_formatted_address.value, env.input.value);
  assert.equal(env.hidden.address_selection_method.value, 'manual');
});

test('address ready event exposes stable handoff detail', async () => {
  const env = makeEnv();
  let detail;
  env.form.addEventListener('address:ready', event => { detail = event.detail; });
  env.input.value = '123 Main St, Fremont, CA';
  env.form.dispatchEvent({ type: 'submit' });
  assert.deepEqual(detail, { method: 'manual', formattedAddress: '123 Main St, Fremont, CA' });
});

test('API key loads Maps JavaScript once and falls back after timeout', async () => {
  const env = makeEnv({ apiKey: 'test-key' });
  const script = env.document.head.children[0];
  assert.ok(script);
  assert.ok(script.src.includes('key=test-key'));
  assert.ok(script.src.includes('libraries=places'));
  await env.runTimers(15000);
  assert.equal(env.input.dataset.addressAutocompleteState, 'unavailable');
});

test('Google ready callback initializes the new Places library', async () => {
  const env = makeEnv({ apiKey: 'test-key' });
  const places = makePlacesGoogle();
  env.window.google = places.google;
  env.window.__coverageFitGooglePlacesReady();
  await flush();
  assert.equal(env.input.dataset.addressAutocompleteState, 'ready');
});

test('Google authentication failure preserves manual fallback', async () => {
  const env = makeEnv({ apiKey: 'test-key' });
  assert.equal(typeof env.window.gm_authFailure, 'function');
  env.window.gm_authFailure();
  assert.equal(env.input.dataset.addressAutocompleteState, 'unavailable');
  env.input.value = '833 Corporate Way, Fremont, CA 94539';
  env.form.dispatchEvent({ type: 'submit' });
  assert.equal(env.hidden.property_formatted_address.value, env.input.value);
});

(async () => {
  let failures = 0;
  for (const t of tests) {
    try { await t.fn(); console.log('PASS', t.name); }
    catch (error) { failures += 1; console.error('FAIL', t.name, '\n ', error.stack); }
  }
  console.log(`\n${tests.length - failures}/${tests.length} address runtime tests passed`);
  process.exitCode = failures ? 1 : 0;
})();
