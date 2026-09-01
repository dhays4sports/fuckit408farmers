/* 408-LOCAL-1.6 — Local Attribution Engine
 * Privacy-safe first-touch Local origin, merchant/surface attribution, event instrumentation,
 * and query propagation into later voluntary 408FARMERS insurance journeys.
 * Never stores consumer identity, merchant-application contact data, property addresses,
 * offer redemption details, or insurance answers.
 */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LocalAttribution = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const BUILD = '408-LOCAL-1.6';
  const SCHEMA = '408-local-attribution-v1';
  const EVENT_SCHEMA = '408-local-event-v1';
  const STORAGE_KEY = '408farmers_local_attribution_v1';
  const SESSION_KEY = '408farmers_local_session_v1';
  const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
  const EVENT_ENDPOINT = '/api/local/event';
  const EVENT_NAMES = Object.freeze(['local_view','merchant_view','perk_open','perk_redeem_intent','insurance_cta_click']);
  const CONTEXT_KEYS = Object.freeze([
    'source','partner_id','perk_id','merchant_slug','surface','campaign','variant',
    'utm_source','utm_medium','utm_campaign','utm_content','utm_term'
  ]);
  const UTM_KEYS = Object.freeze(['utm_source','utm_medium','utm_campaign','utm_content','utm_term']);
  const INSURANCE_PATHS = Object.freeze({
    '/': 'insurance_root',
    '/home/': 'home',
    '/home': 'home',
    '/auto-bundle/': 'auto_bundle',
    '/auto-bundle': 'auto_bundle',
    '/life/': 'life',
    '/life': 'life'
  });
  const emitted = new Set();
  let currentContext = null;
  let mounted = false;

  function nowMs(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function safeStorage(type, suppliedRoot) {
    const host = suppliedRoot || root;
    try {
      const storage = host && host[type];
      if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return null;
      const probe = '__408_local_storage_probe__';
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return storage;
    } catch (_) {
      return null;
    }
  }

  function token(value, max) {
    const text = String(value == null ? '' : value).trim().toLowerCase();
    if (!text) return '';
    const bounded = text.slice(0, max || 120);
    // Deliberately accept campaign-safe tokens only. Spaces, @, /, ? and other
    // characters that could carry free-form/identity data are discarded.
    return /^[a-z0-9][a-z0-9._-]*$/.test(bounded) ? bounded : '';
  }

  function route(value) {
    const text = String(value == null ? '' : value).trim();
    if (!/^\/local\/(?:[a-z0-9-]+\/?)?$/.test(text) && text !== '/local' && text !== '/local/') return '/local/';
    return text.slice(0, 160);
  }

  function destinationToken(value) {
    const normalized = token(value, 40);
    return ['insurance_root','home','auto_bundle','life','other'].includes(normalized) ? normalized : 'other';
  }

  function defaultContext(pathname) {
    const path = String(pathname || '/local/');
    const merchantPath = /^\/local\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(path);
    const merchantSlug = merchantPath && !['data','detail','join'].includes(merchantPath[1]) ? merchantPath[1] : '';
    return {
      source: 'local',
      partner_id: '',
      perk_id: '',
      merchant_slug: merchantSlug,
      surface: merchantSlug ? 'merchant_page' : 'directory',
      campaign: 'local_perks',
      variant: merchantSlug ? 'merchant_page' : 'directory',
      utm_source: '408farmers_local',
      utm_medium: 'local_network',
      utm_campaign: 'local_perks',
      utm_content: merchantSlug || 'directory',
      utm_term: ''
    };
  }

  function normalizeContext(input, defaults) {
    const base = Object.assign({}, defaults || defaultContext('/local/'));
    const source = input && typeof input === 'object' ? input : {};
    const out = {};
    out.source = 'local';
    out.partner_id = token(source.partner_id || base.partner_id, 64);
    out.perk_id = token(source.perk_id || base.perk_id, 64);
    out.merchant_slug = token(source.merchant_slug || base.merchant_slug, 80);
    out.surface = token(source.surface || base.surface, 60) || 'directory';
    out.campaign = token(source.campaign || base.campaign, 100) || 'local_perks';
    out.variant = token(source.variant || base.variant, 80) || 'directory';
    UTM_KEYS.forEach((key) => {
      const max = key === 'utm_term' ? 160 : 120;
      out[key] = token(source[key] || base[key], max);
    });
    if (!out.utm_source) out.utm_source = '408farmers_local';
    if (!out.utm_medium) out.utm_medium = 'local_network';
    if (!out.utm_campaign) out.utm_campaign = out.campaign;
    if (!out.utm_content) out.utm_content = out.partner_id || out.merchant_slug || out.surface;
    return Object.freeze(out);
  }

  function contextFromSearch(search, pathname) {
    let params;
    try { params = new URLSearchParams(search || ''); } catch (_) { params = new URLSearchParams(''); }
    const raw = {};
    CONTEXT_KEYS.forEach((key) => { if (params.has(key)) raw[key] = params.get(key); });
    // Existing campaign URLs sometimes use campaign_variant rather than variant.
    if (!raw.variant && params.has('campaign_variant')) raw.variant = params.get('campaign_variant');
    const defaults = defaultContext(pathname);
    return normalizeContext(raw, defaults);
  }

  function hasExplicitOrigin(search) {
    let params;
    try { params = new URLSearchParams(search || ''); } catch (_) { return false; }
    return ['partner_id','perk_id','merchant_slug','surface','campaign','variant','campaign_variant','utm_source','utm_medium','utm_campaign','utm_content'].some((key) => params.has(key));
  }

  function readStored(storage, now) {
    if (!storage) return null;
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
      if (!parsed || parsed.schema_version !== SCHEMA || !parsed.context) return null;
      if (!Number.isFinite(Number(parsed.expires_at)) || Number(parsed.expires_at) <= nowMs(now)) {
        storage.removeItem(STORAGE_KEY);
        return null;
      }
      return normalizeContext(parsed.context, defaultContext('/local/'));
    } catch (_) {
      return null;
    }
  }

  function persist(context, storage, now) {
    if (!storage || !context) return false;
    const captured = nowMs(now);
    const record = {
      schema_version: SCHEMA,
      captured_at: captured,
      expires_at: captured + RETENTION_MS,
      context: normalizeContext(context, defaultContext('/local/'))
    };
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(record));
      return true;
    } catch (_) {
      return false;
    }
  }

  function capture(locationLike, options) {
    const opts = options || {};
    const locationRef = locationLike || (root && root.location) || { pathname: '/local/', search: '' };
    const storage = opts.storage || safeStorage('localStorage', opts.root);
    const now = nowMs(opts.now);
    const incoming = contextFromSearch(locationRef.search || '', locationRef.pathname || '/local/');
    const stored = readStored(storage, now);
    const explicit = hasExplicitOrigin(locationRef.search || '');

    let selected;
    if (explicit || !stored) {
      selected = incoming;
    } else {
      // Preserve the first meaningful Local origin, but let page defaults fill fields
      // that did not exist in an older stored record.
      selected = normalizeContext(stored, incoming);
    }
    currentContext = selected;
    persist(selected, storage, now);
    return selected;
  }

  function snapshot(options) {
    if (currentContext) return Object.freeze(Object.assign({}, currentContext));
    const opts = options || {};
    const storage = opts.storage || safeStorage('localStorage', opts.root);
    const stored = readStored(storage, opts.now);
    if (stored) {
      currentContext = stored;
      return Object.freeze(Object.assign({}, stored));
    }
    const locationRef = opts.location || (root && root.location) || { pathname: '/local/', search: '' };
    return capture(locationRef, opts);
  }

  function saveContext(next, options) {
    const opts = options || {};
    const normalized = normalizeContext(next, snapshot(opts));
    currentContext = normalized;
    persist(normalized, opts.storage || safeStorage('localStorage', opts.root), opts.now);
    return normalized;
  }

  function attachMerchant(viewModel, options) {
    if (!viewModel || !viewModel.merchant) return snapshot(options);
    const existing = snapshot(options);
    const merchant = viewModel.merchant;
    const perk = viewModel.perk || null;
    // Only claim the merchant as the origin when no earlier merchant origin exists.
    if (!existing.partner_id && !existing.merchant_slug) {
      return saveContext(Object.assign({}, existing, {
        partner_id: token(merchant.merchant_id, 64),
        merchant_slug: token(merchant.slug, 80),
        perk_id: perk ? token(perk.perk_id, 64) : '',
        utm_content: existing.utm_content === 'directory' ? token(merchant.merchant_id, 64) : existing.utm_content
      }), options);
    }
    if (existing.merchant_slug === token(merchant.slug, 80) && !existing.partner_id) {
      return saveContext(Object.assign({}, existing, { partner_id: token(merchant.merchant_id, 64), perk_id: perk ? token(perk.perk_id, 64) : existing.perk_id }), options);
    }
    if (existing.merchant_slug === token(merchant.slug, 80) && !existing.perk_id && perk) {
      return saveContext(Object.assign({}, existing, { perk_id: token(perk.perk_id, 64) }), options);
    }
    return existing;
  }

  function createUuid(host) {
    const cryptoRef = host && host.crypto ? host.crypto : (root && root.crypto ? root.crypto : null);
    if (cryptoRef && typeof cryptoRef.randomUUID === 'function') return cryptoRef.randomUUID();
    const bytes = new Uint8Array(16);
    if (cryptoRef && typeof cryptoRef.getRandomValues === 'function') cryptoRef.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }

  function sessionId(options) {
    const opts = options || {};
    const host = opts.root || root;
    const storage = opts.storage || safeStorage('sessionStorage', host);
    if (storage) {
      try {
        const existing = storage.getItem(SESSION_KEY);
        if (/^[0-9a-f-]{36}$/i.test(existing || '')) return existing;
      } catch (_) {}
    }
    const created = createUuid(host);
    if (storage) {
      try { storage.setItem(SESSION_KEY, created); } catch (_) {}
    }
    return created;
  }

  function campaignId(context) {
    const ctx = normalizeContext(context, defaultContext('/local/'));
    return ['local', ctx.partner_id || ctx.merchant_slug || 'directory', ctx.surface || 'directory']
      .map((part) => token(part, 50) || 'local')
      .join('-')
      .slice(0, 160);
  }

  function decorateUrl(input, overrides, options) {
    const opts = options || {};
    const baseOrigin = opts.origin || (root && root.location && root.location.origin) || 'https://408farmers.com';
    let url;
    try { url = new URL(input, baseOrigin); } catch (_) { return String(input || ''); }
    const context = normalizeContext(Object.assign({}, snapshot(opts), overrides || {}), defaultContext('/local/'));
    CONTEXT_KEYS.forEach((key) => {
      if (context[key]) url.searchParams.set(key, context[key]);
      else url.searchParams.delete(key);
    });
    // Compatibility with existing 408FARMERS attribution fields.
    url.searchParams.set('campaign_id', campaignId(context));
    url.searchParams.set('campaign_variant', context.variant);
    return url.pathname + url.search + url.hash;
  }

  function merchantOverridesFromAnchor(anchor) {
    if (!anchor || !anchor.dataset) return {};
    return {
      partner_id: token(anchor.dataset.localPartnerId, 64),
      perk_id: token(anchor.dataset.localPerkId, 64),
      merchant_slug: token(anchor.dataset.localMerchantSlug, 80),
      variant: 'merchant_page',
      utm_content: token(anchor.dataset.localPartnerId || anchor.dataset.localMerchantSlug, 120)
    };
  }

  function decorateScope(scope, options) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return 0;
    let changed = 0;
    Array.from(scope.querySelectorAll('a[data-local-merchant-link]')).forEach((anchor) => {
      const decorated = decorateUrl(anchor.getAttribute('href') || '', merchantOverridesFromAnchor(anchor), options);
      if (decorated) { anchor.setAttribute('href', decorated); changed += 1; }
    });
    Array.from(scope.querySelectorAll('a[data-local-insurance-cta]')).forEach((anchor) => {
      const href = anchor.getAttribute('href') || '';
      let parsed;
      try { parsed = new URL(href, (root && root.location && root.location.origin) || 'https://408farmers.com'); } catch (_) { return; }
      if (parsed.origin !== ((root && root.location && root.location.origin) || 'https://408farmers.com')) return;
      const decorated = decorateUrl(href, {}, options);
      if (decorated) { anchor.setAttribute('href', decorated); changed += 1; }
    });
    return changed;
  }

  function eventMerchantContext(viewModel) {
    if (!viewModel || !viewModel.merchant) return {};
    return {
      partner_id: token(viewModel.merchant.merchant_id, 64),
      merchant_slug: token(viewModel.merchant.slug, 80),
      perk_id: viewModel.perk ? token(viewModel.perk.perk_id, 64) : ''
    };
  }

  function buildEvent(eventName, extra, options) {
    if (!EVENT_NAMES.includes(eventName)) return null;
    const opts = options || {};
    const origin = snapshot(opts);
    const eventContext = normalizeContext(Object.assign({}, origin, extra && extra.context ? extra.context : {}), origin);
    const locationRef = opts.location || (root && root.location) || { pathname: '/local/' };
    const payload = {
      schema_version: EVENT_SCHEMA,
      event_id: createUuid(opts.root || root),
      session_id: sessionId(opts),
      event_name: eventName,
      occurred_at: new Date(nowMs(opts.now)).toISOString(),
      context: {
        source: 'local',
        partner_id: eventContext.partner_id,
        perk_id: eventContext.perk_id,
        merchant_slug: eventContext.merchant_slug,
        surface: eventContext.surface,
        campaign: eventContext.campaign,
        variant: eventContext.variant,
        utm_source: eventContext.utm_source,
        utm_medium: eventContext.utm_medium,
        utm_campaign: eventContext.utm_campaign,
        utm_content: eventContext.utm_content,
        utm_term: eventContext.utm_term,
        origin_partner_id: origin.partner_id,
        origin_perk_id: origin.perk_id,
        origin_merchant_slug: origin.merchant_slug,
        origin_surface: origin.surface,
        route: route(locationRef.pathname || '/local/'),
        destination: destinationToken(extra && extra.destination)
      }
    };
    return payload;
  }

  function pushAnalytics(payload, options) {
    if (!payload) return;
    const opts = options || {};
    const host = opts.root || root;
    const flattened = Object.assign({
      event: payload.event_name,
      local_build: BUILD,
      local_event_schema: EVENT_SCHEMA,
      local_event_id: payload.event_id,
      local_session_id: payload.session_id
    }, payload.context);
    if (host) {
      host.dataLayer = host.dataLayer || [];
      host.dataLayer.push(flattened);
      try {
        if (host.document && typeof host.CustomEvent === 'function') {
          host.document.dispatchEvent(new host.CustomEvent('408farmers:local-event', { detail: flattened }));
        }
      } catch (_) {}
    }
  }

  function transport(payload, options) {
    const opts = options || {};
    const host = opts.root || root;
    const fetcher = opts.fetch || (host && typeof host.fetch === 'function' ? host.fetch.bind(host) : null);
    if (!fetcher || !payload) return Promise.resolve(false);
    return fetcher(EVENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Local-Event-Version': '1' },
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify(payload)
    }).then((response) => Boolean(response && response.ok)).catch(() => false);
  }

  function emit(eventName, extra, options) {
    const opts = options || {};
    const onceKey = opts.onceKey || '';
    if (onceKey && emitted.has(onceKey)) return null;
    const payload = buildEvent(eventName, extra || {}, opts);
    if (!payload) return null;
    if (onceKey) emitted.add(onceKey);
    pushAnalytics(payload, opts);
    if (opts.transport !== false) transport(payload, opts);
    return payload;
  }

  function insuranceDestination(anchor) {
    if (!anchor) return 'other';
    if (anchor.dataset && anchor.dataset.localInsuranceDestination) return destinationToken(anchor.dataset.localInsuranceDestination);
    try {
      const parsed = new URL(anchor.getAttribute('href') || '', (root && root.location && root.location.origin) || 'https://408farmers.com');
      return INSURANCE_PATHS[parsed.pathname] || 'other';
    } catch (_) { return 'other'; }
  }

  function bindClicks(doc, options) {
    if (!doc || doc.documentElement && doc.documentElement.dataset.localAttributionClicks === 'true') return false;
    if (doc.documentElement) doc.documentElement.dataset.localAttributionClicks = 'true';
    doc.addEventListener('click', (event) => {
      const target = event.target && typeof event.target.closest === 'function' ? event.target.closest('a') : null;
      if (!target) return;
      if (target.matches('[data-local-insurance-cta]')) {
        // Refresh the href immediately before navigation in case merchant context changed.
        target.setAttribute('href', decorateUrl(target.getAttribute('href') || '', {}, options));
        emit('insurance_cta_click', { destination: insuranceDestination(target) }, options);
      }
    }, true);
    return true;
  }

  function mount(doc, locationLike, options) {
    if (mounted) return snapshot(options);
    const documentRef = doc || (root && root.document);
    const locationRef = locationLike || (root && root.location);
    if (!documentRef || !locationRef || !/^\/local(?:\/|$)/.test(locationRef.pathname || '')) return null;
    mounted = true;
    const opts = Object.assign({}, options || {}, { location: locationRef });
    const context = capture(locationRef, opts);
    decorateScope(documentRef, opts);
    bindClicks(documentRef, opts);
    if (locationRef.pathname === '/local/' || locationRef.pathname === '/local') {
      emit('local_view', {}, Object.assign({}, opts, { onceKey: 'local_view:/local/' }));
    }
    return context;
  }

  if (root && root.document && root.location) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => mount(root.document, root.location));
    else mount(root.document, root.location);
  }

  return Object.freeze({
    BUILD,
    SCHEMA,
    EVENT_SCHEMA,
    STORAGE_KEY,
    SESSION_KEY,
    RETENTION_MS,
    EVENT_ENDPOINT,
    EVENT_NAMES,
    CONTEXT_KEYS,
    token,
    defaultContext,
    normalizeContext,
    contextFromSearch,
    hasExplicitOrigin,
    readStored,
    persist,
    capture,
    snapshot,
    saveContext,
    attachMerchant,
    createUuid,
    sessionId,
    campaignId,
    decorateUrl,
    decorateScope,
    eventMerchantContext,
    buildEvent,
    pushAnalytics,
    transport,
    emit,
    insuranceDestination,
    bindClicks,
    mount
  });
});
