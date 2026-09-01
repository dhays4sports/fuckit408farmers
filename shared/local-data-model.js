(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LocalDataModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = '408-local-merchant-v1';
  const CATEGORIES = new Set(['eat-drink', 'home', 'auto']);
  const STATUSES = new Set(['draft', 'active', 'paused', 'inactive']);
  const REDEMPTION_METHODS = new Set(['show_screen', 'merchant_code', 'merchant_instruction']);
  const INDEPENDENT_OFFER_SENTENCE = 'No insurance purchase or quote required.';
  const FORBIDDEN_ENDORSEMENT_PATTERNS = [
    /recommended\s+by\s+(?:farmers|408farmers)/i,
    /(?:farmers|408farmers)\s+(?:recommended|preferred|approved|certified|endorsed|vetted)/i,
    /endorsed\s+by\s+(?:farmers|408farmers)/i,
    /approved\s+by\s+(?:farmers|408farmers)/i,
    /certified\s+by\s+(?:farmers|408farmers)/i,
    /vetted\s+by\s+(?:farmers|408farmers)/i
  ];

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function isNullableString(value) {
    return value === null || typeof value === 'string';
  }

  function parseTime(value) {
    if (value === null || value === undefined || value === '') return null;
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : NaN;
  }

  function hasForbiddenEndorsementLanguage(value) {
    if (!value) return false;
    return FORBIDDEN_ENDORSEMENT_PATTERNS.some((pattern) => pattern.test(String(value)));
  }

  function validateCatalog(catalog) {
    const errors = [];
    const add = (path, message) => errors.push({ path, message });

    if (!isPlainObject(catalog)) {
      add('$', 'catalog must be an object');
      return errors;
    }
    if (catalog.schema_version !== SCHEMA_VERSION) add('schema_version', `must equal ${SCHEMA_VERSION}`);
    if (typeof catalog.dataset_version !== 'string' || !catalog.dataset_version.trim()) add('dataset_version', 'is required');
    if (!isPlainObject(catalog.program)) add('program', 'must be an object');
    if (!Array.isArray(catalog.merchants)) add('merchants', 'must be an array');
    if (!Array.isArray(catalog.perks)) add('perks', 'must be an array');
    if (errors.length) return errors;

    const merchantIds = new Set();
    const merchantSlugs = new Set();
    const perkIds = new Set();

    catalog.merchants.forEach((merchant, index) => {
      const p = `merchants[${index}]`;
      if (!isPlainObject(merchant)) return add(p, 'must be an object');
      const requiredStrings = ['merchant_id','name','slug','category','neighborhood','city','address_display','description_short','description_long','status'];
      requiredStrings.forEach((key) => {
        if (typeof merchant[key] !== 'string' || !merchant[key].trim()) add(`${p}.${key}`, 'must be a non-empty string');
      });
      if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(merchant.merchant_id || '')) add(`${p}.merchant_id`, 'must be a stable lowercase ID');
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(merchant.slug || '')) add(`${p}.slug`, 'must be a canonical lowercase slug');
      if (!CATEGORIES.has(merchant.category)) add(`${p}.category`, 'must be eat-drink, home, or auto');
      if (!STATUSES.has(merchant.status)) add(`${p}.status`, 'must use a supported lifecycle status');
      if (typeof merchant.featured !== 'boolean') add(`${p}.featured`, 'must be boolean');
      if (!Number.isInteger(merchant.sort_order) || merchant.sort_order < 0) add(`${p}.sort_order`, 'must be a non-negative integer');
      ['website_url','instagram_url','image','logo'].forEach((key) => {
        if (!isNullableString(merchant[key])) add(`${p}.${key}`, 'must be string or null');
      });
      ['website_url','instagram_url'].forEach((key) => {
        if (merchant[key] !== null && !/^https:\/\//i.test(merchant[key])) add(`${p}.${key}`, 'must be an https URL or null');
      });
      if (merchantIds.has(merchant.merchant_id)) add(`${p}.merchant_id`, 'must be unique');
      merchantIds.add(merchant.merchant_id);
      if (merchantSlugs.has(merchant.slug)) add(`${p}.slug`, 'must be unique');
      merchantSlugs.add(merchant.slug);
      ['name','description_short','description_long'].forEach((key) => {
        if (hasForbiddenEndorsementLanguage(merchant[key])) add(`${p}.${key}`, 'must not imply Farmers/408FARMERS endorsement');
      });
    });

    catalog.perks.forEach((perk, index) => {
      const p = `perks[${index}]`;
      if (!isPlainObject(perk)) return add(p, 'must be an object');
      const requiredStrings = ['perk_id','merchant_id','headline','summary','terms','status','redemption_method','independent_offer_text'];
      requiredStrings.forEach((key) => {
        if (typeof perk[key] !== 'string' || !perk[key].trim()) add(`${p}.${key}`, 'must be a non-empty string');
      });
      if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(perk.perk_id || '')) add(`${p}.perk_id`, 'must be a stable lowercase ID');
      if (!merchantIds.has(perk.merchant_id)) add(`${p}.merchant_id`, 'must reference an existing merchant');
      if (!STATUSES.has(perk.status)) add(`${p}.status`, 'must use a supported lifecycle status');
      if (!REDEMPTION_METHODS.has(perk.redemption_method)) add(`${p}.redemption_method`, 'must use a supported redemption method');
      if (typeof perk.evergreen !== 'boolean') add(`${p}.evergreen`, 'must be boolean');
      if (!isNullableString(perk.start_at)) add(`${p}.start_at`, 'must be ISO date-time string or null');
      if (!isNullableString(perk.end_at)) add(`${p}.end_at`, 'must be ISO date-time string or null');
      const start = parseTime(perk.start_at);
      const end = parseTime(perk.end_at);
      if (Number.isNaN(start)) add(`${p}.start_at`, 'must be a parseable ISO date-time or null');
      if (Number.isNaN(end)) add(`${p}.end_at`, 'must be a parseable ISO date-time or null');
      if (Number.isFinite(start) && Number.isFinite(end) && end <= start) add(`${p}.end_at`, 'must be later than start_at');
      if (!perk.evergreen && perk.end_at === null) add(`${p}.end_at`, 'is required when evergreen is false');
      if (!String(perk.independent_offer_text || '').includes(INDEPENDENT_OFFER_SENTENCE)) {
        add(`${p}.independent_offer_text`, `must contain "${INDEPENDENT_OFFER_SENTENCE}"`);
      }
      if (perkIds.has(perk.perk_id)) add(`${p}.perk_id`, 'must be unique');
      perkIds.add(perk.perk_id);
      ['headline','summary','terms','independent_offer_text'].forEach((key) => {
        if (hasForbiddenEndorsementLanguage(perk[key])) add(`${p}.${key}`, 'must not imply Farmers/408FARMERS endorsement');
      });
    });

    return errors;
  }

  function resolvePerkAvailability(perk, now) {
    const nowMs = now instanceof Date ? now.getTime() : (typeof now === 'number' ? now : Date.parse(now || new Date().toISOString()));
    if (!perk || !STATUSES.has(perk.status)) return { state: 'invalid', is_active: false };
    if (perk.status !== 'active') return { state: perk.status, is_active: false };
    const start = parseTime(perk.start_at);
    const end = parseTime(perk.end_at);
    if (Number.isFinite(start) && nowMs < start) return { state: 'scheduled', is_active: false };
    if (Number.isFinite(end) && nowMs > end) return { state: 'expired', is_active: false };
    return { state: 'active', is_active: true };
  }

  function buildMerchantUrl(slug) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '')) throw new Error('Invalid merchant slug');
    return `/local/${slug}/`;
  }

  function getMerchantViewModels(catalog, options) {
    const opts = Object.assign({ include_non_active: false, include_fixtures: false, now: new Date() }, options || {});
    const errors = validateCatalog(catalog);
    if (errors.length) {
      const error = new Error(`Invalid Local catalog (${errors.length} error${errors.length === 1 ? '' : 's'})`);
      error.validationErrors = errors;
      throw error;
    }

    const perksByMerchant = new Map();
    catalog.perks.forEach((perk) => {
      const list = perksByMerchant.get(perk.merchant_id) || [];
      list.push(perk);
      perksByMerchant.set(perk.merchant_id, list);
    });

    return catalog.merchants
      .filter((merchant) => opts.include_fixtures || merchant.fixture !== true)
      .filter((merchant) => opts.include_non_active || merchant.status === 'active')
      .map((merchant) => {
        const perkStates = (perksByMerchant.get(merchant.merchant_id) || []).map((perk) => ({
          perk,
          availability: resolvePerkAvailability(perk, opts.now)
        }));
        const activePerk = perkStates.find((item) => item.availability.is_active) || null;
        return Object.freeze({
          merchant: Object.freeze(Object.assign({}, merchant)),
          merchant_url: buildMerchantUrl(merchant.slug),
          perk: activePerk ? Object.freeze(Object.assign({}, activePerk.perk)) : null,
          perk_state: activePerk ? activePerk.availability.state : null,
          all_perk_states: Object.freeze(perkStates.map((item) => Object.freeze({ perk_id: item.perk.perk_id, state: item.availability.state, is_active: item.availability.is_active })))
        });
      })
      .sort((a, b) => (a.merchant.sort_order - b.merchant.sort_order) || a.merchant.name.localeCompare(b.merchant.name));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // QA/fixture renderer only in 1.2. 1.3 can consume the same view model for the public directory.
  function renderMerchantFixtureMarkup(viewModel) {
    if (!viewModel || !viewModel.merchant) throw new Error('merchant view model required');
    const m = viewModel.merchant;
    const perk = viewModel.perk;
    return [
      `<article class="local-model-fixture" data-merchant-id="${escapeHtml(m.merchant_id)}">`,
      `<p class="local-model-fixture__category">${escapeHtml(m.category)}</p>`,
      `<h3>${escapeHtml(m.name)}</h3>`,
      `<p>${escapeHtml(m.neighborhood)}, ${escapeHtml(m.city)}</p>`,
      `<p>${escapeHtml(m.description_short)}</p>`,
      perk ? `<p class="local-model-fixture__perk">${escapeHtml(perk.headline)}</p>` : '<p class="local-model-fixture__perk">No active perk</p>',
      `<a href="${escapeHtml(viewModel.merchant_url)}">Merchant route</a>`,
      '</article>'
    ].join('');
  }

  async function loadCatalog(url, fetchImpl) {
    const fetcher = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (!fetcher) throw new Error('fetch is not available');
    const response = await fetcher(url || '/local/data/catalog.json', { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Local catalog request failed: ${response.status}`);
    const catalog = await response.json();
    const errors = validateCatalog(catalog);
    if (errors.length) {
      const error = new Error(`Invalid Local catalog (${errors.length} errors)`);
      error.validationErrors = errors;
      throw error;
    }
    return catalog;
  }

  return Object.freeze({
    SCHEMA_VERSION,
    INDEPENDENT_OFFER_SENTENCE,
    validateCatalog,
    resolvePerkAvailability,
    buildMerchantUrl,
    getMerchantViewModels,
    renderMerchantFixtureMarkup,
    loadCatalog
  });
});
