#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DEFAULT_FARMERS_BASE = 'https://408farmers.com';
const DEFAULT_COVERAGEFIT_BASE = 'https://coveragefit.com';
const EXPECTED_BUILD = '408-CONV-1.1';
const EXPECTED_CONTRACT = 'coveragefit-handoff-v1';
const EXPECTED_RECEIVER = 'v3.20.8';
const PROFILE_KEY = 'coveragefit_prospect_profile_v1';
const TRANSITION_KEY = 'coveragefit_transition_v1';
const PII_KEYS = [
  'first_name', 'last_name', 'phone', 'email', 'property_address',
  'home_review_goal', 'housing_context', 'review_timing',
  'property_street', 'property_city', 'property_county', 'property_state',
  'property_zip', 'property_country', 'property_place_id', 'address_selection_method'
];

const ROUTES = [
  { path: '/home/', entry: 'home_lander_form', surface: 'home_lander', reviewContext: 'Current policy renewal', senderBuild: '408-HOME-2.9' },
  { path: '/tech/', entry: 'tech_eligibility_form', surface: 'occupation_tech', reviewContext: 'Professional eligibility and home coverage review', occupationSegment: 'Software or engineering' },
  { path: '/engineers/', entry: 'engineers_eligibility_form', surface: 'occupation_engineer', reviewContext: 'Professional eligibility and home coverage review', occupationSegment: 'Electrical' },
  { path: '/healthcare/', entry: 'healthcare_eligibility_form', surface: 'occupation_healthcare', reviewContext: 'Professional eligibility and home coverage review', occupationSegment: 'Nurse or RN' },
  { path: '/teachers/', entry: 'teachers_eligibility_form', surface: 'occupation_education', reviewContext: 'Professional eligibility and home coverage review', occupationSegment: 'Teacher or instructor' }
];

function parseArgs(argv) {
  const args = {
    farmersBase: DEFAULT_FARMERS_BASE,
    coverageFitBase: DEFAULT_COVERAGEFIT_BASE,
    formspreeEndpoint: '',
    submit: false,
    acknowledgeLeads: false,
    timeoutMs: 15000,
    output: ''
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--farmers-base') args.farmersBase = argv[++i];
    else if (arg === '--coveragefit-base') args.coverageFitBase = argv[++i];
    else if (arg === '--formspree-endpoint') args.formspreeEndpoint = argv[++i];
    else if (arg === '--submit') args.submit = true;
    else if (arg === '--acknowledge-leads') args.acknowledgeLeads = true;
    else if (arg === '--timeout') args.timeoutMs = Number(argv[++i]) || args.timeoutMs;
    else if (arg === '--output') args.output = argv[++i];
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  args.farmersBase = normalizeBase(args.farmersBase);
  args.coverageFitBase = normalizeBase(args.coverageFitBase);
  return args;
}

function normalizeBase(value) {
  return String(value || '').replace(/\/+$/, '');
}

function helpText() {
  return [
    '408FARMERS production handoff smoke certification',
    '',
    'Read-only production verification:',
    '  node qa/production-handoff-smoke.js',
    '',
    'Full Formspree submission verification (creates five clearly labeled test leads):',
    '  node qa/production-handoff-smoke.js --submit --acknowledge-leads',
    '',
    'Options:',
    '  --farmers-base URL',
    '  --coveragefit-base URL',
    '  --formspree-endpoint URL',
    '  --timeout MILLISECONDS',
    '  --output FILE.json'
  ].join('\n');
}

function storage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    dump: () => Object.fromEntries(values.entries())
  };
}

async function fetchResource(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      ...options,
      headers: {
        'User-Agent': '408FARMERS-Handoff-Smoke/1.0',
        ...(options.headers || {})
      },
      signal: controller.signal
    });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timer);
  }
}

function attribute(html, name) {
  const match = String(html).match(new RegExp(`${name}=["']([^"']*)["']`, 'i'));
  return match ? match[1] : '';
}

function hiddenValue(html, name) {
  const patterns = [
    new RegExp(`<input[^>]*name=["']${name}["'][^>]*value=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<input[^>]*value=["']([^"']*)["'][^>]*name=["']${name}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = String(html).match(pattern);
    if (match) return match[1];
  }
  return '';
}

function extractConfig(configSource) {
  const endpoint = String(configSource).match(/formEndpoint:\s*["']([^"']+)["']/)?.[1] || '';
  const coverageFitHomeUrl = String(configSource).match(/coverageFitHomeUrl:\s*["']([^"']+)["']/)?.[1] || '';
  return { endpoint, coverageFitHomeUrl };
}

function addCheck(report, name, passed, detail = '') {
  report.checks.push({ name, passed: Boolean(passed), detail: String(detail || '') });
  if (!passed) report.failures += 1;
}

function createSenderRuntime({ pathname, coverageFitBase, launcherSource, profileSource }) {
  const window = {
    location: {
      origin: new URL(coverageFitBase).origin.replace('coveragefit', '408farmers'),
      pathname,
      search: '?utm_source=production-smoke&utm_medium=qa&utm_campaign=handoff-certification&referral=realtor-partner',
      assign() {}
    },
    sessionStorage: storage(),
    localStorage: storage(),
    crypto: { randomUUID: () => `smoke-${pathname.replace(/\W/g, '') || 'home'}-session` },
    dataLayer: [],
    CustomEvent: function(type, init) { this.type = type; this.detail = init.detail; },
    LANDING_PAGE_CONFIG: {
      coverageFitHomeUrl: `${normalizeBase(coverageFitBase)}/home/`,
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
  vm.runInContext(launcherSource, context);
  vm.runInContext(profileSource, context);
  return window;
}

function fakeForm({ campaign, source, reviewContext, occupationSegment = '', slug }) {
  const values = {
    first_name: 'Production',
    last_name: `Smoke ${slug}`,
    phone: '(408) 555-0100',
    email: `smoke+${slug}@408farmers.com`,
    property_address: '1 Test Way, Fremont, CA 94539',
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
    occupation_segment: occupationSegment,
    housing_context: '',
    campaign,
    source,
    utm_source: 'production-smoke',
    utm_medium: 'qa',
    utm_campaign: 'handoff-certification',
    utm_content: '',
    utm_term: ''
  };
  const elements = {};
  Object.keys(values).forEach(key => { elements[key] = { value: values[key] }; });
  return { elements, values };
}

function buildSenderHandoff({ route, pageHtml, launcherSource, profileSource, coverageFitBase }) {
  const campaign = hiddenValue(pageHtml, 'campaign');
  const source = hiddenValue(pageHtml, 'source');
  const senderBuild = attribute(pageHtml, 'data-sender-build') || EXPECTED_BUILD;
  const handoffContract = attribute(pageHtml, 'data-handoff-contract') || EXPECTED_CONTRACT;
  const runtime = createSenderRuntime({
    pathname: route.path,
    coverageFitBase,
    launcherSource,
    profileSource
  });
  const slug = route.path.replace(/\//g, '') || 'home';
  const form = fakeForm({ campaign, source, reviewContext: route.reviewContext, occupationSegment: route.occupationSegment, slug });
  const profile = runtime.ProspectProfileBuilder.fromForm(form);
  const destination = runtime.CoverageFitLauncher.buildUrl({
    profile,
    campaign: profile.campaign,
    entry: route.entry,
    assessment: 'home',
    extra: {
      launch_surface: route.surface,
      lead_captured: 'true',
      sender_build: senderBuild,
      handoff_contract: handoffContract
    }
  });
  return { destination, profile, formValues: form.values, campaign, source };
}

function runReceiverIntake({ source, handoffUrl, coverageFitBase }) {
  const parsed = new URL(handoffUrl);
  const sessionStorage = storage();
  const localStorage = storage();
  let redirected = '';
  let cleaned = '';
  const location = {
    origin: new URL(coverageFitBase).origin,
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
    href: parsed.toString(),
    replace: value => { redirected = value; }
  };
  const history = {
    state: null,
    replaceState: (_a, _b, value) => { cleaned = value; }
  };
  const window = {
    location,
    history,
    dispatchEvent() {},
    sessionStorage,
    localStorage
  };
  const document = { title: 'CoverageFit' };
  const context = {
    window, location, history, sessionStorage, localStorage, document,
    URL, URLSearchParams, Date, console,
    CustomEvent: function(type, options) { this.type = type; this.detail = options.detail; }
  };
  window.window = window;
  window.document = document;
  window.URL = URL;
  window.URLSearchParams = URLSearchParams;
  window.CustomEvent = context.CustomEvent;
  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    redirected,
    cleaned,
    profile: JSON.parse(sessionStorage.getItem(PROFILE_KEY) || 'null'),
    transition: JSON.parse(sessionStorage.getItem(TRANSITION_KEY) || 'null'),
    sessionStorage,
    localStorage
  };
}

function createTransitionNode({ label = false, final = false, hidden = false } = {}) {
  const labelNode = { textContent: '' };
  const finalMessageNode = { textContent: '' };
  return {
    dataset: {}, attributes: {}, textContent: '', href: '', hidden,
    focus() {}, addEventListener(_type, callback) { this.listener = callback; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    removeAttribute(name) { delete this.attributes[name]; },
    querySelector(selector) {
      if (label && selector === '.transition-step-label') return labelNode;
      if (final && selector === '.transition-final-message') return finalMessageNode;
      return null;
    }
  };
}

function runTransition({ attributionSource, personalizationSource, transitionSource, intake, coverageFitBase }) {
  let redirected = '';
  const parsed = new URL(intake.redirected || '/transition/', coverageFitBase);
  const stepNodes = Array.from({ length: 4 }, () => createTransitionNode({ label: true }));
  const elements = {
    transitionKicker: createTransitionNode(), transitionHeading: createTransitionNode(),
    transitionMessage: createTransitionNode(), transitionStatus: createTransitionNode(),
    transitionContinue: createTransitionNode(), transitionFinal: createTransitionNode({ final: true }),
    transitionFinalKicker: createTransitionNode(), transitionFinalMessage: createTransitionNode(),
    transitionProperty: createTransitionNode({ hidden: true }), transitionPropertyLabel: createTransitionNode(),
    transitionPropertyAddress: createTransitionNode(), transitionPropertyDetail: createTransitionNode()
  };
  const timers = [];
  let timerId = 1;
  const location = {
    origin: new URL(coverageFitBase).origin,
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
    href: parsed.toString(),
    replace: value => { redirected = value; }
  };
  const document = {
    title: 'Preparing Your CoverageFit Review', referrer: 'https://408farmers.com/home/',
    documentElement: { dataset: {} }, body: { setAttribute() {} },
    getElementById: id => elements[id] || null,
    querySelectorAll: selector => selector === '[data-transition-step]' ? stepNodes : [],
    addEventListener() {}, createElement: () => createTransitionNode()
  };
  const window = {
    location, document,
    sessionStorage: intake.sessionStorage, localStorage: intake.localStorage,
    crypto: { randomUUID: () => 'coveragefit-smoke-session' },
    matchMedia: () => ({ matches: false }),
    setTimeout(callback, delay) { const item = { id: timerId++, callback, delay, cancelled: false }; timers.push(item); return item.id; },
    clearTimeout(id) { const item = timers.find(timer => timer.id === id); if (item) item.cancelled = true; },
    requestAnimationFrame(callback) { callback(); return 1; }, cancelAnimationFrame() {},
    addEventListener() {}, dispatchEvent() {}
  };
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options?.detail; } }
  Object.assign(window, { window, URL, URLSearchParams, CustomEvent });
  const context = {
    window, document, location, sessionStorage: intake.sessionStorage, localStorage: intake.localStorage,
    URL, URLSearchParams, CustomEvent, Date, Number, Object, Math, String, JSON, console
  };
  vm.createContext(context);
  vm.runInContext(attributionSource, context);
  vm.runInContext(personalizationSource, context);
  vm.runInContext(transitionSource, context);

  while (true) {
    const pending = timers.filter(item => !item.cancelled && !item.ran).sort((a, b) => a.delay - b.delay)[0];
    if (!pending) break;
    pending.ran = true;
    pending.callback();
  }
  return {
    redirected,
    state: document.documentElement.dataset.transitionState,
    reasonKey: window.CoverageFitPersonalization?.get?.().journey?.reasonKey || '',
    referralSource: window.CoverageFitPersonalization?.get?.().journey?.referralSource || '',
    welcome: JSON.parse(intake.sessionStorage.getItem('coveragefit_transition_welcome_v1') || 'null')
  };
}

async function submitSyntheticLead(endpoint, route, values, timeoutMs) {
  const body = new FormData();
  Object.entries(values).forEach(([key, value]) => body.append(key, value));
  body.append('smoke_test', 'true');
  body.append('smoke_route', route.path);
  body.append('_subject', `[AUTOMATED SMOKE TEST] ${route.entry}`);
  body.append('consent', 'Automated production smoke test. Do not contact.');
  const { response, text } = await fetchResource(endpoint, {
    method: 'POST',
    body,
    headers: { Accept: 'application/json' }
  }, timeoutMs);
  return { ok: response.ok, status: response.status, body: text.slice(0, 500) };
}

async function runSmoke(options = {}) {
  const farmersBase = normalizeBase(options.farmersBase || DEFAULT_FARMERS_BASE);
  const coverageFitBase = normalizeBase(options.coverageFitBase || DEFAULT_COVERAGEFIT_BASE);
  const timeoutMs = Number(options.timeoutMs) || 15000;
  const submit = Boolean(options.submit);
  const acknowledgeLeads = Boolean(options.acknowledgeLeads);
  if (submit && !acknowledgeLeads) {
    throw new Error('--submit requires --acknowledge-leads because it creates five labeled test submissions.');
  }

  const report = {
    sprint: '408-HO-1F',
    checkedAt: new Date().toISOString(),
    farmersBase,
    coverageFitBase,
    mode: submit ? 'full-submit' : 'read-only',
    status: 'NO-GO',
    failures: 0,
    checks: [],
    routes: []
  };

  let manifest = null;
  let configSource = '';
  let launcherSource = '';
  let profileSource = '';
  let sharedScriptSource = '';
  let prefillSource = '';
  let attributionSource = '';
  let personalizationSource = '';
  let transitionSource = '';
  let endpoint = options.formspreeEndpoint || '';

  try {
    const fetched = await fetchResource(`${farmersBase}/handoff-manifest.json`, {}, timeoutMs);
    addCheck(report, 'production handoff manifest returns HTTP 200', fetched.response.ok, fetched.response.status);
    if (fetched.response.ok) manifest = JSON.parse(fetched.text);
    addCheck(report, 'production build fingerprint matches 408-CONV-1.1', manifest?.build === EXPECTED_BUILD, manifest?.build || 'missing');
    addCheck(report, 'production contract fingerprint matches stable handoff schema', manifest?.handoffContract === EXPECTED_CONTRACT, manifest?.handoffContract || 'missing');
  } catch (error) {
    addCheck(report, 'production handoff manifest is readable', false, error.message);
  }

  const assetRequests = [
    ['config', `${farmersBase}/shared/config.js`],
    ['launcher', `${farmersBase}/shared/coveragefit-launch.js`],
    ['profile', `${farmersBase}/shared/prospect-profile.js`],
    ['form behavior', `${farmersBase}/shared/script.js`]
  ];
  for (const [label, url] of assetRequests) {
    try {
      const fetched = await fetchResource(url, {}, timeoutMs);
      addCheck(report, `${label} asset returns HTTP 200`, fetched.response.ok, fetched.response.status);
      if (label === 'config') configSource = fetched.text;
      if (label === 'launcher') launcherSource = fetched.text;
      if (label === 'profile') profileSource = fetched.text;
      if (label === 'form behavior') sharedScriptSource = fetched.text;
    } catch (error) {
      addCheck(report, `${label} asset is readable`, false, error.message);
    }
  }

  const liveConfig = extractConfig(configSource);
  if (!endpoint) endpoint = liveConfig.endpoint;
  addCheck(report, 'Formspree endpoint is configured', Boolean(endpoint), endpoint || 'missing');
  addCheck(report, 'CoverageFit destination is configured', liveConfig.coverageFitHomeUrl.includes('/home/'), liveConfig.coverageFitHomeUrl || 'missing');
  addCheck(report, 'form behavior sends deployment fingerprint', sharedScriptSource.includes('sender_build') && sharedScriptSource.includes('handoff_contract'), 'sender_build + handoff_contract');

  let transitionHtml = '';
  try {
    const home = await fetchResource(`${coverageFitBase}/home/`, {}, timeoutMs);
    addCheck(report, 'CoverageFit Home returns HTTP 200', home.response.ok, home.response.status);
  } catch (error) {
    addCheck(report, 'CoverageFit Home is reachable', false, error.message);
  }
  try {
    const transition = await fetchResource(`${coverageFitBase}/transition/`, {}, timeoutMs);
    transitionHtml = transition.text;
    addCheck(report, 'CoverageFit transition route returns HTTP 200', transition.response.ok, transition.response.status);
    addCheck(report, 'CoverageFit transition loads intake before route behavior',
      transitionHtml.indexOf('/assets/js/prefill-intake.js') >= 0 &&
      transitionHtml.indexOf('/assets/js/prefill-intake.js') < transitionHtml.indexOf('/assets/js/attribution.js') &&
      transitionHtml.indexOf('/assets/js/attribution.js') < transitionHtml.indexOf('/assets/js/personalization-context.js') &&
      transitionHtml.indexOf('/assets/js/personalization-context.js') < transitionHtml.indexOf('/assets/js/transition-route.js'),
      'prefill-intake.js → attribution.js → personalization-context.js → transition-route.js');
  } catch (error) {
    addCheck(report, 'CoverageFit transition route is reachable', false, error.message);
  }
  try {
    const prefill = await fetchResource(`${coverageFitBase}/assets/js/prefill-intake.js`, {}, timeoutMs);
    prefillSource = prefill.text;
    addCheck(report, 'CoverageFit prefill intake asset returns HTTP 200', prefill.response.ok, prefill.response.status);
    addCheck(report, 'CoverageFit intake recognizes handoff markers', prefillSource.includes("params.get('prefill') === '1'") && prefillSource.includes('handoff_version'), 'prefill + handoff_version');
    addCheck(report, 'CoverageFit intake cleans personal query fields', prefillSource.includes('PII_KEYS') && prefillSource.includes('replaceState'), 'PII_KEYS + replaceState');
  } catch (error) {
    addCheck(report, 'CoverageFit prefill intake asset is reachable', false, error.message);
  }
  try {
    const attribution = await fetchResource(`${coverageFitBase}/assets/js/attribution.js`, {}, timeoutMs);
    attributionSource = attribution.text;
    addCheck(report, 'CoverageFit v3.20.8 attribution asset returns HTTP 200', attribution.response.ok, attribution.response.status);
    addCheck(report, 'CoverageFit attribution accepts canonical ref', attributionSource.includes("'ref'") && attributionSource.includes('ALLOWED'), 'ref in ALLOWED');
  } catch (error) {
    addCheck(report, 'CoverageFit v3.20.8 attribution asset is reachable', false, error.message);
  }
  try {
    const personalization = await fetchResource(`${coverageFitBase}/assets/js/personalization-context.js`, {}, timeoutMs);
    personalizationSource = personalization.text;
    addCheck(report, 'CoverageFit v3.20.8 personalization asset returns HTTP 200', personalization.response.ok, personalization.response.status);
    addCheck(report, 'CoverageFit personalization normalizes referral source', personalizationSource.includes('referralSource') && personalizationSource.includes('lastTouch.ref'), 'lastTouch.ref → referralSource');
  } catch (error) {
    addCheck(report, 'CoverageFit v3.20.8 personalization asset is reachable', false, error.message);
  }
  try {
    const transitionRoute = await fetchResource(`${coverageFitBase}/assets/js/transition-route.js`, {}, timeoutMs);
    transitionSource = transitionRoute.text;
    addCheck(report, 'CoverageFit v3.20.8 transition behavior asset returns HTTP 200', transitionRoute.response.ok, transitionRoute.response.status);
    addCheck(report, 'CoverageFit transition validates same-origin destinations', transitionSource.includes('parsed.origin !== window.location.origin'), 'same-origin destination guard');
  } catch (error) {
    addCheck(report, 'CoverageFit v3.20.8 transition behavior asset is reachable', false, error.message);
  }

  for (const route of ROUTES) {
    const routeReport = { path: route.path, entry: route.entry, checks: [], formspree: submit ? 'pending' : 'not-submitted' };
    report.routes.push(routeReport);
    let pageHtml = '';
    try {
      const fetched = await fetchResource(`${farmersBase}${route.path}`, {}, timeoutMs);
      pageHtml = fetched.text;
      const routeCheck = (name, passed, detail = '') => {
        routeReport.checks.push({ name, passed: Boolean(passed), detail: String(detail || '') });
        addCheck(report, `${route.path} ${name}`, passed, detail);
      };
      routeCheck('returns HTTP 200', fetched.response.ok, fetched.response.status);
      routeCheck('is not blank', pageHtml.trim().length > 1000, `${pageHtml.length} bytes`);
      routeCheck('exposes current build fingerprint', pageHtml.includes('408farmers-handoff-build') && pageHtml.includes(EXPECTED_BUILD), EXPECTED_BUILD);
      routeCheck('opts into CoverageFit after successful submission', pageHtml.includes('data-coveragefit-after-submit="true"'), 'data-coveragefit-after-submit');
      routeCheck('uses expected entry', attribute(pageHtml, 'data-cf-entry') === route.entry, attribute(pageHtml, 'data-cf-entry'));
      routeCheck('uses expected launch surface', attribute(pageHtml, 'data-cf-extra-launch-surface') === route.surface, attribute(pageHtml, 'data-cf-extra-launch-surface'));
      routeCheck('uses current handoff contract', attribute(pageHtml, 'data-handoff-contract') === EXPECTED_CONTRACT, attribute(pageHtml, 'data-handoff-contract'));
      const sharedPrefix = route.path === '/home/' ? '/shared/' : '../shared/';
      routeCheck('loads launcher, profile builder, and form behavior in order',
        pageHtml.indexOf(sharedPrefix + 'coveragefit-launch.js') >= 0 &&
        pageHtml.indexOf(sharedPrefix + 'coveragefit-launch.js') < pageHtml.indexOf(sharedPrefix + 'prospect-profile.js') &&
        pageHtml.indexOf(sharedPrefix + 'prospect-profile.js') < pageHtml.indexOf(sharedPrefix + 'script.js'),
        'launcher → profile → form');

      if (launcherSource && profileSource && prefillSource && attributionSource && personalizationSource && transitionSource) {
        const handoff = buildSenderHandoff({ route, pageHtml, launcherSource, profileSource, coverageFitBase });
        const handoffUrl = new URL(handoff.destination);
        routeReport.handoffUrl = `${handoffUrl.origin}${handoffUrl.pathname}?<redacted>`;
        routeCheck('generates personalized handoff markers', handoffUrl.searchParams.get('prefill') === '1' && handoffUrl.searchParams.get('handoff_version') === '1', 'prefill=1 + handoff_version=1');
        routeCheck('preserves route attribution', handoffUrl.searchParams.get('entry') === route.entry && handoffUrl.searchParams.get('launch_surface') === route.surface, `${handoffUrl.searchParams.get('entry')} / ${handoffUrl.searchParams.get('launch_surface')}`);
        routeCheck('preserves build and stable contract fingerprint', handoffUrl.searchParams.get('sender_build') === (route.senderBuild || EXPECTED_BUILD) && handoffUrl.searchParams.get('handoff_contract') === EXPECTED_CONTRACT, `${handoffUrl.searchParams.get('sender_build')} / ${handoffUrl.searchParams.get('handoff_contract')}`);
        routeCheck('includes canonical prospect fields', PII_KEYS.slice(0, 5).every(key => handoffUrl.searchParams.has(key)) && handoffUrl.searchParams.has('review_context'), 'name, phone, email, address, review reason');
        routeCheck('maps referral into canonical ref parameter', handoffUrl.searchParams.get('ref') === 'realtor-partner' && !handoffUrl.searchParams.has('referral'), handoffUrl.searchParams.get('ref') || 'missing');

        const intake = runReceiverIntake({ source: prefillSource, handoffUrl: handoff.destination, coverageFitBase });
        routeCheck('CoverageFit stores the prospect profile', Boolean(intake.profile?.fullName && intake.profile?.propertyAddress), intake.profile?.fullName || 'missing');
        routeCheck('CoverageFit creates transition state', intake.transition?.destination === '/home/' && intake.transition?.hasProfile === true, intake.transition?.destination || 'missing');
        routeCheck('CoverageFit redirects through /transition/', intake.redirected.startsWith('/transition/'), intake.redirected || 'missing');
        routeCheck('transition URL contains no personal fields', !PII_KEYS.some(key => intake.redirected.includes(`${key}=`)), intake.redirected || 'missing');

        const transitionRun = runTransition({ attributionSource, personalizationSource, transitionSource, intake, coverageFitBase });
        routeCheck('transition returns to CoverageFit Home', transitionRun.redirected === '/home/', transitionRun.redirected || 'missing');
        routeCheck('CoverageFit v3.20.8 transition recognizes the handoff', transitionRun.state === 'ready', transitionRun.state || 'missing');
        routeCheck('CoverageFit v3.20.8 canonical context preserves referral', transitionRun.referralSource === 'realtor-partner', transitionRun.referralSource || 'missing');
        routeCheck('CoverageFit v3.20.8 writes a completion receipt', transitionRun.welcome?.hasProfile === true && transitionRun.welcome?.destination === '/home/', transitionRun.welcome?.destination || 'missing');

        if (submit) {
          const submission = await submitSyntheticLead(endpoint, route, handoff.formValues, timeoutMs);
          routeReport.formspree = submission.ok ? 'passed' : 'failed';
          routeReport.formspreeStatus = submission.status;
          routeCheck('Formspree accepts labeled synthetic submission', submission.ok, submission.status);
        }
      } else {
        routeCheck('end-to-end CoverageFit v3.20.8 source assets are available', false, 'sender or receiver asset missing');
      }
    } catch (error) {
      addCheck(report, `${route.path} journey executes without error`, false, error.message);
      routeReport.error = error.message;
      if (submit) routeReport.formspree = 'not-attempted';
    }
  }

  report.passed = report.checks.length - report.failures;
  report.total = report.checks.length;
  report.status = report.failures === 0 ? 'CERTIFIED' : 'NO-GO';
  return report;
}

function printSummary(report) {
  console.log(JSON.stringify({
    sprint: report.sprint,
    checkedAt: report.checkedAt,
    mode: report.mode,
    status: report.status,
    total: report.total,
    passed: report.passed,
    failed: report.failures
  }, null, 2));
  for (const check of report.checks.filter(item => !item.passed)) {
    console.error('FAIL', check.name, check.detail ? `— ${check.detail}` : '');
  }
}

if (require.main === module) {
  (async () => {
    try {
      const args = parseArgs(process.argv.slice(2));
      if (args.help) {
        console.log(helpText());
        return;
      }
      const report = await runSmoke(args);
      printSummary(report);
      if (args.output) {
        const destination = path.resolve(args.output);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        console.log(`Report written to ${destination}`);
      }
      process.exitCode = report.status === 'CERTIFIED' ? 0 : 1;
    } catch (error) {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    }
  })();
}

module.exports = {
  ROUTES,
  EXPECTED_BUILD,
  EXPECTED_CONTRACT,
  EXPECTED_RECEIVER,
  parseArgs,
  runSmoke,
  buildSenderHandoff,
  runReceiverIntake,
  runTransition
};
