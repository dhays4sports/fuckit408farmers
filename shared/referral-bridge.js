(function (root, factory) {
  'use strict';
  var api = factory(root);
  root.Farmers408ReferralBridge = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var VERSION = '1.1.0';
  var BUILD = '408-NP-1.5';
  var TOKEN_PATTERN = /^ref_[A-Za-z0-9_-]{16}$/;
  var ROUTE_PATTERN = /^\/neighbor\/r\/(ref_[A-Za-z0-9_-]{16})\/?$/;
  var GENERIC_ROUTES = ['/neighbor', '/neighbor/'];
  var SHARE_CHANNELS = ['sms', 'native', 'copy'];
  var COVERAGEFIT_DESTINATION = 'https://coveragefit.com/home/';
  var DEFAULT_DELAY_MS = 2300;
  var REDUCED_MOTION_DELAY_MS = 650;
  var EXIT_DELAY_MS = 120;
  var ATTRIBUTION_KEYS = ['campaign', 'campaign_id', 'campaign_variant', 'campaign_zip', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'creative'];

  function text(value, fallback) {
    if (value === 0) return '0';
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return fallback || '';
  }

  function clean(value, max) {
    return text(value).replace(/[<>\u0000-\u001F\u007F]/g, '').slice(0, max || 120);
  }

  function readRoute(locationRef) {
    var locationValue = locationRef || root.location || {};
    var pathname = text(locationValue.pathname, '/neighbor/');
    var match = pathname.match(ROUTE_PATTERN);
    var params;
    try { params = new URLSearchParams(text(locationValue.search)); }
    catch (_) { params = new URLSearchParams(''); }

    var shareValues = params.getAll('share');
    var shareChannel = shareValues.length === 1 && SHARE_CHANNELS.indexOf(text(shareValues[0])) !== -1
      ? text(shareValues[0])
      : '';
    var attribution = {};
    ATTRIBUTION_KEYS.forEach(function (key) {
      var values = params.getAll(key);
      if (values.length === 1) {
        var value = clean(values[0]);
        if (value) attribution[key] = value;
      }
    });

    if (match && TOKEN_PATTERN.test(match[1])) {
      return Object.freeze({
        validToken: true,
        generic: false,
        token: match[1],
        shareChannel: shareChannel,
        attribution: Object.freeze(attribution),
        reason: 'valid_path'
      });
    }

    return Object.freeze({
      validToken: false,
      generic: true,
      token: '',
      shareChannel: shareChannel,
      attribution: Object.freeze(attribution),
      reason: GENERIC_ROUTES.indexOf(pathname) !== -1 ? 'generic_path' : 'invalid_path_fallback'
    });
  }

  function defaultMedium(channel) {
    if (channel === 'sms') return 'sms';
    if (channel === 'native') return 'native_share';
    if (channel === 'copy') return 'copied_link';
    return 'shared_link';
  }

  function buildDestination(route, options) {
    var state = route || readRoute(options && options.location);
    var base = text(options && options.destination, COVERAGEFIT_DESTINATION);
    var destination = new URL(base);
    destination.searchParams.set('ref', 'neighbor');
    if (state.validToken && TOKEN_PATTERN.test(state.token)) destination.searchParams.set('rid', state.token);
    if (SHARE_CHANNELS.indexOf(state.shareChannel) !== -1) destination.searchParams.set('share', state.shareChannel);
    destination.searchParams.set('source', '408farmers');
    destination.searchParams.set('entry', 'neighbor_referral_bridge');
    destination.searchParams.set('bridge', BUILD);

    var attribution = state.attribution || {};
    ATTRIBUTION_KEYS.forEach(function (key) {
      if (attribution[key]) destination.searchParams.set(key, attribution[key]);
    });
    if (!destination.searchParams.has('campaign')) destination.searchParams.set('campaign', 'neighbor_referral');
    if (!destination.searchParams.has('utm_source')) destination.searchParams.set('utm_source', 'neighbor_share');
    if (!destination.searchParams.has('utm_medium')) destination.searchParams.set('utm_medium', defaultMedium(state.shareChannel));
    if (!destination.searchParams.has('utm_campaign')) destination.searchParams.set('utm_campaign', 'coveragefit_neighbor_pass');
    if (!destination.searchParams.has('utm_content')) destination.searchParams.set('utm_content', '408farmers_bridge');
    destination.hash = '';
    return destination.toString();
  }

  function setState(node, state, current) {
    if (!node) return;
    node.dataset.state = state;
    if (current) node.setAttribute('aria-current', 'step');
    else node.removeAttribute('aria-current');
  }

  function render(options) {
    var settings = options || {};
    var documentRef = settings.document || root.document;
    if (!documentRef) return { rendered: false, reason: 'document_missing' };
    var route = settings.route || readRoute(settings.location || root.location);
    var destination = buildDestination(route, settings);
    var continueLink = documentRef.querySelector && documentRef.querySelector('[data-bridge-continue]');
    if (continueLink) continueLink.href = destination;

    if (route.generic) {
      var kicker = documentRef.querySelector && documentRef.querySelector('[data-bridge-kicker]');
      var heading = documentRef.querySelector && documentRef.querySelector('[data-bridge-heading]');
      var message = documentRef.querySelector && documentRef.querySelector('[data-bridge-message]');
      if (kicker) kicker.textContent = 'Neighbor-Shared Coverage Review';
      if (heading) heading.textContent = 'Preparing your CoverageFit review';
      if (message) message.textContent = 'You’re securely continuing to the standard neighbor-shared home coverage review. No personal information is included in this link.';
    }

    return { rendered: true, route: route, destination: destination };
  }

  function start(options) {
    var settings = options || {};
    var documentRef = settings.document || root.document;
    var locationRef = settings.location || root.location || {};
    var rendered = render({ ...settings, document: documentRef, location: locationRef });
    if (!rendered.rendered) return rendered;

    var reduced = false;
    try { reduced = Boolean((settings.matchMedia || root.matchMedia) && (settings.matchMedia || root.matchMedia)('(prefers-reduced-motion: reduce)').matches); } catch (_) {}
    var delay = Number(settings.delayMs);
    if (!Number.isFinite(delay) || delay < 0) delay = reduced ? REDUCED_MOTION_DELAY_MS : DEFAULT_DELAY_MS;
    var schedule = settings.setTimeout || root.setTimeout;
    var steps = documentRef.querySelectorAll ? Array.from(documentRef.querySelectorAll('[data-bridge-step]')) : [];
    var status = documentRef.getElementById ? documentRef.getElementById('bridgeLiveStatus') : null;
    var labels = ['Shared review received', 'Secure handoff prepared', 'CoverageFit review ready'];

    function advance(index) {
      steps.forEach(function (step, stepIndex) {
        if (stepIndex < index) setState(step, 'complete', false);
        else if (stepIndex === index) setState(step, 'active', true);
        else setState(step, 'pending', false);
      });
      if (status) status.textContent = labels[index] || labels[labels.length - 1];
    }

    if (typeof schedule === 'function') {
      var fractions = reduced ? [0, .28, .55] : [0, .28, .62];
      fractions.forEach(function (fraction, index) {
        schedule(function () { advance(index); }, Math.round(delay * fraction));
      });
      schedule(function () {
        steps.forEach(function (step) { setState(step, 'complete', false); });
        if (status) status.textContent = 'Opening your CoverageFit review';
        if (documentRef.body) documentRef.body.setAttribute('aria-busy', 'false');
        schedule(function () {
          try {
            if (typeof settings.navigate === 'function') settings.navigate(rendered.destination);
            else if (typeof locationRef.replace === 'function') locationRef.replace(rendered.destination);
            else if (typeof locationRef.assign === 'function') locationRef.assign(rendered.destination);
          } catch (_) {}
        }, EXIT_DELAY_MS);
      }, delay);
    }

    return { ...rendered, delayMs: delay, reducedMotion: reduced };
  }

  function autoStart() {
    if (!root.document) return;
    var run = function () { start(); };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
  }

  var api = Object.freeze({
    VERSION: VERSION,
    BUILD: BUILD,
    TOKEN_PATTERN: TOKEN_PATTERN,
    ROUTE_PATTERN: ROUTE_PATTERN,
    GENERIC_ROUTES: GENERIC_ROUTES.slice(),
    SHARE_CHANNELS: SHARE_CHANNELS.slice(),
    COVERAGEFIT_DESTINATION: COVERAGEFIT_DESTINATION,
    DEFAULT_DELAY_MS: DEFAULT_DELAY_MS,
    REDUCED_MOTION_DELAY_MS: REDUCED_MOTION_DELAY_MS,
    ATTRIBUTION_KEYS: ATTRIBUTION_KEYS.slice(),
    readRoute: readRoute,
    buildDestination: buildDestination,
    render: render,
    start: start
  });

  autoStart();
  return api;
});
