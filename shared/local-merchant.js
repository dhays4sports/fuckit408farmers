(function (root, factory) {
  'use strict';
  const model = (typeof module === 'object' && module.exports)
    ? require('./local-data-model.js')
    : root.LocalDataModel;
  const attribution = (typeof module === 'object' && module.exports)
    ? require('./local-attribution.js')
    : root.LocalAttribution;
  const api = factory(model, attribution);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LocalMerchant = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (LocalDataModel, LocalAttribution) {
  'use strict';

  const CATEGORY_LABELS = Object.freeze({
    'eat-drink': 'Eat & Drink',
    'home': 'Home',
    'auto': 'Auto'
  });
  const RESERVED_LOCAL_SLUGS = new Set(['data', 'detail', 'join']);

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeAssetUrl(value) {
    if (!value || typeof value !== 'string') return null;
    if (/^https:\/\//i.test(value)) return value;
    if (/^\/(?!\/)[A-Za-z0-9_./%-]+$/.test(value) && !value.includes('..')) return value;
    return null;
  }

  function safeExternalUrl(value) {
    if (!value || typeof value !== 'string' || !/^https:\/\//i.test(value)) return null;
    return value;
  }

  function getSlugFromPath(pathname) {
    const match = String(pathname || '').match(/^\/local\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
    if (!match || RESERVED_LOCAL_SLUGS.has(match[1])) return null;
    return match[1];
  }

  function getMerchantDetailViewModel(catalog, slug, options) {
    if (!LocalDataModel) throw new Error('LocalDataModel is required');
    if (!slug || RESERVED_LOCAL_SLUGS.has(slug)) return null;
    const opts = Object.assign({ now: new Date() }, options || {});
    const viewModels = LocalDataModel.getMerchantViewModels(catalog, {
      now: opts.now,
      include_non_active: false,
      include_fixtures: false
    });
    const found = viewModels.find((vm) => vm.merchant.slug === slug);
    if (!found) return null;
    return Object.freeze(Object.assign({}, found, {
      program: Object.freeze(Object.assign({}, catalog.program || {}))
    }));
  }

  function buildDirectionsUrl(address) {
    const value = String(address || '').trim();
    if (!value) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
  }

  function renderMedia(merchant) {
    const image = safeAssetUrl(merchant.image);
    const logo = safeAssetUrl(merchant.logo);
    const initials = escapeHtml(String(merchant.name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'LOCAL');
    return [
      '<div class="local-detail-media">',
      image
        ? `<img class="local-detail-photo" src="${escapeHtml(image)}" alt="" decoding="async"/>`
        : `<div class="local-detail-placeholder" aria-hidden="true"><span>${initials}</span></div>`,
      logo ? `<img class="local-detail-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(merchant.name)} logo" decoding="async"/>` : '',
      '</div>'
    ].join('');
  }

  function renderMerchantLinks(merchant) {
    const website = safeExternalUrl(merchant.website_url);
    const instagram = safeExternalUrl(merchant.instagram_url);
    const directions = buildDirectionsUrl(merchant.address_display);
    const links = [];
    if (website) links.push(`<a class="local-detail-link" href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">Website <span aria-hidden="true">↗</span></a>`);
    if (instagram) links.push(`<a class="local-detail-link" href="${escapeHtml(instagram)}" target="_blank" rel="noopener noreferrer">Instagram <span aria-hidden="true">↗</span></a>`);
    if (directions) links.push(`<a class="local-detail-link" href="${escapeHtml(directions)}" target="_blank" rel="noopener noreferrer">Directions <span aria-hidden="true">↗</span></a>`);
    return links.length ? `<div class="local-detail-links">${links.join('')}</div>` : '';
  }

  function renderRedemptionDialog(viewModel) {
    if (!viewModel || !viewModel.perk || viewModel.perk.redemption_method !== 'show_screen') return '';
    const m = viewModel.merchant;
    const perk = viewModel.perk;
    return [
      '<dialog class="local-redemption-dialog" data-local-redemption-dialog aria-labelledby="local-redemption-title">',
      '<div class="local-redemption-card">',
      '<button class="local-redemption-close" type="button" data-local-redemption-close aria-label="Close perk screen">×</button>',
      '<div class="local-redemption-brand"><span>408</span><strong>FARMERS LOCAL PERK</strong></div>',
      '<p class="local-redemption-instruction">Show this screen at</p>',
      `<h2 id="local-redemption-title">${escapeHtml(m.name)}</h2>`,
      '<div class="local-redemption-offer">',
      `<p class="local-redemption-headline">${escapeHtml(perk.headline)}</p>`,
      `<p class="local-redemption-summary">${escapeHtml(perk.summary)}</p>`,
      '</div>',
      '<div class="local-redemption-ready" aria-label="Perk ready to show"><span aria-hidden="true">✓</span><strong>Ready to show</strong></div>',
      '<div class="local-redemption-terms">',
      '<strong>Merchant terms</strong>',
      `<p>${escapeHtml(perk.terms)}</p>`,
      '</div>',
      `<p class="local-redemption-independent">${escapeHtml(perk.independent_offer_text)}</p>`,
      '<p class="local-redemption-note">This screen displays the currently published Local offer. The participating merchant controls fulfillment, availability and any additional offer conditions.</p>',
      '<button class="local-secondary local-redemption-done" type="button" data-local-redemption-close>Done</button>',
      '</div>',
      '</dialog>'
    ].join('');
  }

  function renderPerkSection(viewModel) {
    const perk = viewModel.perk;
    if (!perk) {
      return [
        '<section class="local-detail-perk local-detail-perk--quiet" aria-labelledby="local-perk-title">',
        '<p class="local-kicker">Current Local perk</p>',
        '<h2 id="local-perk-title">No active offer right now.</h2>',
        '<p>This business can remain in the Local directory while an offer is paused, scheduled or being refreshed. An unavailable offer cannot be opened or redeemed.</p>',
        '</section>'
      ].join('');
    }
    if (perk.redemption_method !== 'show_screen') {
      return [
        '<section class="local-detail-perk" aria-labelledby="local-perk-title">',
        '<p class="local-kicker">Current Local perk</p>',
        `<h2 id="local-perk-title">${escapeHtml(perk.headline)}</h2>`,
        `<p class="local-detail-perk-summary">${escapeHtml(perk.summary)}</p>`,
        '<div class="local-detail-perk-actions"><span>Online show-your-screen redemption is not available for this offer.</span></div>',
        '<div class="local-detail-terms"><strong>Merchant terms</strong>',
        `<p>${escapeHtml(perk.terms)}</p></div>`,
        `<p class="local-independent-offer local-independent-offer--detail">${escapeHtml(perk.independent_offer_text)}</p>`,
        '</section>'
      ].join('');
    }
    return [
      '<section class="local-detail-perk" aria-labelledby="local-perk-title">',
      '<p class="local-kicker">Current Local perk</p>',
      `<h2 id="local-perk-title">${escapeHtml(perk.headline)}</h2>`,
      `<p class="local-detail-perk-summary">${escapeHtml(perk.summary)}</p>`,
      '<div class="local-detail-perk-actions">',
      '<button class="local-primary local-use-perk" type="button" data-local-use-perk>Use This Perk</button>',
      '<span>No account or insurance form required.</span>',
      '</div>',
      '<div class="local-detail-terms">',
      '<strong>Merchant terms</strong>',
      `<p>${escapeHtml(perk.terms)}</p>`,
      '</div>',
      `<p class="local-independent-offer local-independent-offer--detail">${escapeHtml(perk.independent_offer_text)}</p>`,
      '</section>',
      renderRedemptionDialog(viewModel)
    ].join('');
  }

  function renderInsuranceBridge(viewModel) {
    if (!viewModel || !viewModel.merchant || !viewModel.perk) return '';
    return [
      '<section class="local-insurance-bridge" data-local-insurance-bridge aria-labelledby="local-insurance-bridge-title">',
      '<div class="local-insurance-bridge-copy">',
      '<p class="local-kicker">Optional insurance review</p>',
      '<h2 id="local-insurance-bridge-title">Own a home in the South Bay?</h2>',
      '<p>If you want, Dylan can also help you review your home coverage or look at home and auto together. This insurance review is separate from the Local perk above.</p>',
      '<p class="local-insurance-bridge-boundary"><strong>Your merchant perk is already available.</strong> Using or skipping an insurance review does not change the offer, its terms, or your ability to use it.</p>',
      '</div>',
      '<div class="local-insurance-bridge-actions" aria-label="Optional insurance review choices">',
      '<a class="local-primary local-insurance-bridge-primary" href="/auto-bundle/" data-local-insurance-cta="merchant_bridge_bundle" data-local-insurance-destination="auto_bundle">Review home + auto <span aria-hidden="true">→</span></a>',
      '<a class="local-secondary local-insurance-bridge-secondary" href="/home/" data-local-insurance-cta="merchant_bridge_home" data-local-insurance-destination="home">Review my home only</a>',
      '<span>No obligation. No quote or policy purchase is required to use the Local perk.</span>',
      '</div>',
      '</section>'
    ].join('');
  }

  function renderMerchantDetail(viewModel) {
    if (!viewModel || !viewModel.merchant) throw new Error('merchant view model required');
    const m = viewModel.merchant;
    const category = CATEGORY_LABELS[m.category] || m.category;
    const relationshipText = viewModel.program && viewModel.program.merchant_relationship_text
      ? viewModel.program.merchant_relationship_text
      : 'Participation in 408FARMERS Local does not imply endorsement, certification, or recommendation by Farmers Insurance or 408FARMERS.';
    return [
      '<a class="local-detail-back" href="/local/"><span aria-hidden="true">←</span> Back to Local</a>',
      '<div class="local-detail-grid">',
      renderMedia(m),
      '<div class="local-detail-copy">',
      '<div class="local-detail-meta">',
      `<span>${escapeHtml(category)}</span>`,
      `<span>${escapeHtml(m.neighborhood)}</span>`,
      '</div>',
      `<h1>${escapeHtml(m.name)}</h1>`,
      `<p class="local-detail-lead">${escapeHtml(m.description_short)}</p>`,
      `<p class="local-detail-description">${escapeHtml(m.description_long)}</p>`,
      `<p class="local-detail-address"><strong>Area</strong><span>${escapeHtml(m.address_display)}</span></p>`,
      renderMerchantLinks(m),
      '</div>',
      '</div>',
      renderPerkSection(viewModel),
      '<section class="local-detail-boundary" aria-label="408FARMERS Local program boundary">',
      '<strong>Local business. Independent merchant offer.</strong>',
      `<p>${escapeHtml(relationshipText)} Local perks do not affect insurance pricing, discounts, eligibility, underwriting or coverage.</p>`,
      '</section>',
      renderInsuranceBridge(viewModel)
    ].join('');
  }

  function renderUnavailable(reason) {
    const invalidRoute = reason === 'invalid-route';
    return [
      '<div class="local-detail-unavailable" role="status">',
      '<p class="local-kicker">408FARMERS LOCAL</p>',
      `<h1>${invalidRoute ? 'This Local route is not available.' : 'This Local business is not currently available.'}</h1>`,
      '<p>Only active participating businesses can appear on public merchant pages. Draft, paused, inactive and fixture records stay private, and unavailable offers cannot be redeemed.</p>',
      '<a class="local-primary" href="/local/">Browse the Local directory</a>',
      '</div>'
    ].join('');
  }

  function updateMetadata(doc, viewModel) {
    if (!doc || !viewModel) return;
    const m = viewModel.merchant;
    const title = `${m.name} | 408FARMERS Local`;
    const description = viewModel.perk
      ? `${viewModel.perk.headline} — a current 408FARMERS Local offer from ${m.name}. No insurance purchase or quote required.`
      : `${m.name} on 408FARMERS Local. No insurance purchase or quote required.`;
    doc.title = title;
    const descriptionMeta = doc.querySelector('meta[name="description"]');
    if (descriptionMeta) descriptionMeta.setAttribute('content', description);
    const robotsMeta = doc.querySelector('meta[name="robots"]');
    if (robotsMeta) robotsMeta.setAttribute('content', 'index,follow');
    const canonical = doc.querySelector('[data-local-canonical]');
    if (canonical) canonical.setAttribute('href', `https://408farmers.com${viewModel.merchant_url}`);
    const ogTitle = doc.querySelector('[data-local-og-title]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    const ogDescription = doc.querySelector('[data-local-og-description]');
    if (ogDescription) ogDescription.setAttribute('content', description);
    const ogImage = doc.querySelector('[data-local-og-image]');
    const image = safeAssetUrl(m.image) || safeAssetUrl(m.logo);
    if (ogImage && image) ogImage.setAttribute('content', image.startsWith('/') ? `https://408farmers.com${image}` : image);
  }

  function bindRedemption(doc, viewModel) {
    if (!doc) return;
    const useButton = doc.querySelector('[data-local-use-perk]');
    const dialog = doc.querySelector('[data-local-redemption-dialog]');
    if (!useButton || !dialog) return;
    const closeButtons = Array.from(dialog.querySelectorAll('[data-local-redemption-close]'));
    function openDialog() {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      const close = dialog.querySelector('[data-local-redemption-close]');
      if (close && typeof close.focus === 'function') close.focus();
    }
    function closeDialog() {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
      if (typeof useButton.focus === 'function') useButton.focus();
    }
    useButton.addEventListener('click', () => {
      if (LocalAttribution && typeof LocalAttribution.emit === 'function') {
        LocalAttribution.emit('perk_redeem_intent', { context: LocalAttribution.eventMerchantContext(viewModel) });
      }
      openDialog();
    });
    closeButtons.forEach((button) => button.addEventListener('click', closeDialog));
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeDialog();
    });
  }


  function mSlug(viewModel) {
    return viewModel && viewModel.merchant ? String(viewModel.merchant.slug || '') : '';
  }

  function initMerchantPage(doc, locationLike) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null);
    const locationRef = locationLike || (typeof window !== 'undefined' ? window.location : null);
    if (!documentRef || !locationRef || !LocalDataModel) return Promise.resolve(null);
    const root = documentRef.querySelector('[data-local-merchant-detail]');
    if (!root) return Promise.resolve(null);
    const slug = getSlugFromPath(locationRef.pathname);
    if (!slug) {
      root.setAttribute('data-local-detail-state', 'unavailable');
      root.innerHTML = renderUnavailable('invalid-route');
      return Promise.resolve(null);
    }
    return LocalDataModel.loadCatalog('/local/data/catalog.json')
      .then((catalog) => {
        const viewModel = getMerchantDetailViewModel(catalog, slug);
        if (!viewModel) {
          root.setAttribute('data-local-detail-state', 'unavailable');
          root.innerHTML = renderUnavailable('not-public');
          return null;
        }
        root.setAttribute('data-local-detail-state', 'ready');
        root.innerHTML = renderMerchantDetail(viewModel);
        updateMetadata(documentRef, viewModel);
        if (LocalAttribution) {
          if (typeof LocalAttribution.attachMerchant === 'function') LocalAttribution.attachMerchant(viewModel);
          if (typeof LocalAttribution.decorateScope === 'function') LocalAttribution.decorateScope(documentRef);
          if (typeof LocalAttribution.emit === 'function') {
            const eventContext = typeof LocalAttribution.eventMerchantContext === 'function' ? LocalAttribution.eventMerchantContext(viewModel) : {};
            LocalAttribution.emit('merchant_view', { context: eventContext }, { onceKey: 'merchant_view:' + mSlug(viewModel) });
            if (viewModel.perk) LocalAttribution.emit('perk_open', { context: eventContext }, { onceKey: 'perk_open:' + viewModel.perk.perk_id });
          }
        }
        bindRedemption(documentRef, viewModel);
        return viewModel;
      })
      .catch(() => {
        root.setAttribute('data-local-detail-state', 'error');
        root.innerHTML = [
          '<div class="local-detail-unavailable local-detail-unavailable--error" role="alert">',
          '<p class="local-kicker">408FARMERS LOCAL</p>',
          '<h1>Local merchant details are temporarily unavailable.</h1>',
          '<p>Please return to the directory and try again later. Insurance reviews elsewhere on 408FARMERS are unaffected.</p>',
          '<a class="local-primary" href="/local/">Back to Local</a>',
          '</div>'
        ].join('');
        return null;
      });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initMerchantPage(document, window.location));
    else initMerchantPage(document, window.location);
  }

  return Object.freeze({
    CATEGORY_LABELS,
    RESERVED_LOCAL_SLUGS,
    safeAssetUrl,
    safeExternalUrl,
    getSlugFromPath,
    getMerchantDetailViewModel,
    buildDirectionsUrl,
    renderRedemptionDialog,
    renderInsuranceBridge,
    renderMerchantDetail,
    renderUnavailable,
    updateMetadata,
    bindRedemption,
    initMerchantPage
  });
});
