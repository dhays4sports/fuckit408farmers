(function (root, factory) {
  'use strict';
  var api = factory(root);
  root.Farmers408FlyerCampaign = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var VERSION = '2.0.0';
  var BUILD = '408-HOME-2.7';
  var FAMILY = 'home_flyer';
  var VARIANTS = ['rate', 'fit'];
  var ZIP_PATTERN = /^\d{5}$/;
  var ID_PATTERN = /^(?:home[_-]?flyer|flyer)[_-](\d{5})[_-](rate|fit)$/i;
  var PATH_PATTERN = /^\/home\/(?:qr|campaign)\/(\d{5})\/(rate|fit)\/?$/i;

  var COPY = Object.freeze({
    rate: Object.freeze({
      eyebrow: '{ZIP} Home Insurance Review',
      title: 'We Recently Found a Competitive Farmers Rate in {ZIP}.',
      lead: 'Every home is rated differently.',
      body: 'Complete a short review, and Dylan will personally evaluate your property, coverage needs, and available bundle opportunities.',
      cta: 'Start My 5-Minute Review',
      reassurance: 'No obligation. Personally reviewed by Dylan. Any available options will be provided by text or phone.',
      label: 'Competitive-rate review'
    }),
    fit: Object.freeze({
      eyebrow: '{ZIP} Farmers Fit Review',
      title: 'Could Your Home Be a Strong Fit for Farmers in {ZIP}?',
      lead: 'Every home is rated differently.',
      body: 'Start with three quick questions, then Dylan will personally evaluate your property, coverage needs, and available bundle opportunities.',
      cta: 'Start My 5-Minute Review',
      reassurance: 'No obligation. Personally reviewed by Dylan. This review is not a quote or eligibility decision.',
      label: 'Farmers-fit review'
    })
  });

  function text(value, fallback) {
    if (value === 0) return '0';
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return fallback || '';
  }

  function normalizeZip(value) {
    var match = text(value).match(/\b(\d{5})(?:-\d{4})?\b/);
    return match && ZIP_PATTERN.test(match[1]) ? match[1] : '';
  }

  function normalizeVariant(value) {
    var candidate = text(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (['a', 'rate', 'rates', 'competitive_rate', 'local_rate', 'rate_proof'].indexOf(candidate) !== -1) return 'rate';
    if (['b', 'fit', 'strong_fit', 'home_fit', 'coverage_fit'].indexOf(candidate) !== -1) return 'fit';
    return '';
  }

  function campaignId(zip, variant) {
    var normalizedZip = normalizeZip(zip);
    var normalizedVariant = normalizeVariant(variant);
    return normalizedZip && normalizedVariant ? FAMILY + '_' + normalizedZip + '_' + normalizedVariant : '';
  }

  function context(zip, variant, entryMethod) {
    var normalizedZip = normalizeZip(zip);
    var normalizedVariant = normalizeVariant(variant);
    if (!normalizedZip || !normalizedVariant) return { active: false, campaign: '', campaignId: '', campaignZip: '', campaignVariant: '', entryMethod: '', qr: false };
    var method = text(entryMethod, 'campaign_query');
    return { active: true, campaign: FAMILY, campaignId: campaignId(normalizedZip, normalizedVariant), campaignZip: normalizedZip, campaignVariant: normalizedVariant, entryMethod: method, qr: method === 'qr_path' || method === 'qr_query' };
  }

  function parseIdentifier(value) {
    var candidate = text(value).replace(/\s+/g, '_');
    var direct = candidate.match(ID_PATTERN);
    if (direct) return context(direct[1], direct[2], 'campaign_identifier');
    var compact = candidate.match(/(?:^|[_-])(\d{5})[_-](rate|fit)(?:$|[_-])/i);
    return compact ? context(compact[1], compact[2], 'campaign_identifier') : context('', '', '');
  }

  function parsePath(pathname) {
    var match = text(pathname).match(PATH_PATTERN);
    return match ? context(match[1], match[2], 'qr_path') : context('', '', '');
  }

  function resolve(input) {
    var source = input && typeof input === 'object' ? input : {};
    var path = parsePath(source.pathname || source.path);
    if (path.active) return path;
    var zip = normalizeZip(source.campaignZip || source.campaign_zip || source.zip);
    var variant = normalizeVariant(source.campaignVariant || source.campaign_variant || source.variant);
    if (zip && variant) {
      var medium = text(source.utmMedium || source.utm_medium).toLowerCase();
      return context(zip, variant, medium === 'qr' ? 'qr_query' : 'campaign_query');
    }
    var candidates = [source.campaignId, source.campaign_id, source.campaign, source.utm_campaign, source.utmContent, source.utm_content, source.content, source.qr];
    for (var i = 0; i < candidates.length; i += 1) {
      var parsed = parseIdentifier(candidates[i]);
      if (parsed.active) return parsed;
    }
    return context('', '', '');
  }

  function queryInput(search) {
    var params;
    try { params = new URLSearchParams(text(search)); } catch (_) { params = new URLSearchParams(''); }
    var input = {};
    ['campaign', 'campaign_id', 'campaign_variant', 'campaign_zip', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'qr'].forEach(function (key) {
      var values = params.getAll(key);
      if (values.length === 1 && text(values[0])) input[key] = text(values[0]);
    });
    return input;
  }

  function readLocation(locationLike) {
    var value = locationLike && typeof locationLike === 'object' ? locationLike : {};
    if (typeof locationLike === 'string') value = { search: locationLike };
    var query = queryInput(value.search === undefined ? (root.location && root.location.search) : value.search);
    query.pathname = value.pathname === undefined ? (root.location && root.location.pathname) : value.pathname;
    return resolve(query);
  }

  var current = readLocation();

  function apply(input, fallbackContext) {
    var output = Object.assign({}, input && typeof input === 'object' ? input : {});
    var campaign = resolve(output);
    if (!campaign.active && fallbackContext && fallbackContext.active) campaign = fallbackContext;
    if (!campaign.active) return output;
    output.campaign = campaign.campaignId;
    output.campaign_id = campaign.campaignId;
    output.campaign_variant = campaign.campaignVariant;
    output.campaign_zip = campaign.campaignZip;
    if (!output.utm_source) output.utm_source = 'flyer';
    if (!output.utm_medium) output.utm_medium = 'qr';
    if (!output.utm_campaign) output.utm_campaign = FAMILY;
    if (!output.utm_content) output.utm_content = campaign.campaignId;
    return output;
  }

  function replaceZip(template, zip) { return text(template).replace(/\{ZIP\}/g, zip); }

  function matchedCopy(value) {
    if (!value || !value.active || !COPY[value.campaignVariant]) return null;
    var source = COPY[value.campaignVariant];
    return Object.freeze({
      eyebrow: replaceZip(source.eyebrow, value.campaignZip),
      title: replaceZip(source.title, value.campaignZip),
      lead: source.lead,
      body: source.body,
      cta: source.cta,
      reassurance: source.reassurance,
      label: source.label,
      badge: 'Connected from your ' + value.campaignZip + ' neighborhood flyer · ' + source.label
    });
  }

  function setField(form, name, value) {
    if (!form || !value) return;
    var input = form.querySelector('[name="' + name + '"]');
    if (!input && form.ownerDocument && form.ownerDocument.createElement) {
      input = form.ownerDocument.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }
    if (input) input.value = value;
  }

  function applyToForm(form, locationLike) {
    var campaign = readLocation(locationLike);
    if (!campaign.active) return campaign;
    setField(form, 'campaign', campaign.campaignId);
    setField(form, 'campaign_id', campaign.campaignId);
    setField(form, 'campaign_variant', campaign.campaignVariant);
    setField(form, 'campaign_zip', campaign.campaignZip);
    setField(form, 'utm_source', 'flyer');
    setField(form, 'utm_medium', 'qr');
    setField(form, 'utm_campaign', FAMILY);
    setField(form, 'utm_content', campaign.campaignId);
    return campaign;
  }

  function setText(selector, value) {
    var node = root.document && root.document.querySelector ? root.document.querySelector(selector) : null;
    if (node && value) node.textContent = value;
  }

  function render(value) {
    if (!root.document || !value || !value.active) return null;
    var copy = matchedCopy(value);
    if (!copy) return null;
    setText('[data-home-campaign-eyebrow]', copy.eyebrow);
    setText('[data-home-campaign-title]', copy.title);
    setText('[data-home-campaign-lead]', copy.lead);
    setText('[data-home-campaign-copy]', copy.body);
    setText('[data-home-campaign-cta]', copy.cta);
    setText('[data-home-campaign-reassurance]', copy.reassurance);
    setText('[data-home-campaign-badge]', copy.badge);
    var badge = root.document.querySelector('[data-home-campaign-badge]');
    if (badge) badge.hidden = false;
    var textLink = root.document.querySelector('.home-text-cta');
    if (textLink) textLink.href = 'sms:+14083276377?body=' + encodeURIComponent('Hi Dylan, I scanned your ' + value.campaignZip + ' home review flyer and would like to start a review.');
    if (root.document.body && root.document.body.dataset) {
      root.document.body.dataset.homeCampaign = value.campaignId;
      root.document.body.dataset.homeCampaignVariant = value.campaignVariant;
      root.document.body.dataset.homeCampaignZip = value.campaignZip;
      root.document.body.dataset.homeCampaignEntry = value.entryMethod;
    }
    root.document.title = value.campaignZip + ' Home Insurance Review | 408-FARMERS';
    var description = root.document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', copy.body);
    try { root.document.dispatchEvent(new root.CustomEvent('408farmers:home-campaign-matched', { detail: Object.assign({}, value, { copy: copy }) })); } catch (_) {}
    return Object.freeze(Object.assign({}, value, { copy: copy }));
  }

  function routeFor(zip, variant, base) {
    var value = context(zip, variant, 'qr_path');
    if (!value.active) return '';
    var origin = text(base, 'https://408farmers.com').replace(/\/+$/, '');
    return origin + '/home/qr/' + value.campaignZip + '/' + value.campaignVariant + '/';
  }

  function autoApply() {
    if (!root.document || !root.document.querySelectorAll) return;
    Array.from(root.document.querySelectorAll('form')).forEach(function (form) { applyToForm(form, root.location || {}); });
    current = readLocation();
    render(current);
  }

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', autoApply, { once: true });
    else autoApply();
  }

  return Object.freeze({ VERSION: VERSION, BUILD: BUILD, FAMILY: FAMILY, VARIANTS: VARIANTS.slice(), ZIP_PATTERN: ZIP_PATTERN, ID_PATTERN: ID_PATTERN, PATH_PATTERN: PATH_PATTERN, COPY: COPY, normalizeZip: normalizeZip, normalizeVariant: normalizeVariant, campaignId: campaignId, parseIdentifier: parseIdentifier, parsePath: parsePath, resolve: resolve, apply: function (input) { return apply(input, current); }, readSearch: function (search) { return readLocation({ search: search, pathname: '' }); }, readLocation: readLocation, matchedCopy: matchedCopy, applyToForm: applyToForm, render: render, routeFor: routeFor, getCurrent: function () { return Object.assign({}, current); } });
});
