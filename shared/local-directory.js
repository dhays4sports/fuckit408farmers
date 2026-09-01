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
  if (root) root.LocalDirectory = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (LocalDataModel, LocalAttribution) {
  'use strict';

  const CATEGORY_META = Object.freeze({
    'all': Object.freeze({ label: 'All', empty: 'Pilot merchants are being added now.' }),
    'eat-drink': Object.freeze({ label: 'Eat & Drink', empty: 'Eat & Drink partners will appear here as offers go live.' }),
    'home': Object.freeze({ label: 'Home', empty: 'Home-service partners will appear here as offers go live.' }),
    'auto': Object.freeze({ label: 'Auto', empty: 'Auto partners will appear here as offers go live.' })
  });

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

  function categoryLabel(category) {
    return (CATEGORY_META[category] || { label: category }).label;
  }

  function getDirectoryViewModels(catalog, options) {
    if (!LocalDataModel) throw new Error('LocalDataModel is required');
    const opts = Object.assign({ now: new Date() }, options || {});
    return LocalDataModel.getMerchantViewModels(catalog, {
      now: opts.now,
      include_non_active: false,
      include_fixtures: false
    }).sort((a, b) => {
      if (a.merchant.featured !== b.merchant.featured) return a.merchant.featured ? -1 : 1;
      return (a.merchant.sort_order - b.merchant.sort_order) || a.merchant.name.localeCompare(b.merchant.name);
    });
  }

  function filterViewModels(viewModels, category) {
    const key = CATEGORY_META[category] ? category : 'all';
    if (key === 'all') return viewModels.slice();
    return viewModels.filter((vm) => vm.merchant.category === key);
  }

  function renderMerchantMedia(merchant) {
    const image = safeAssetUrl(merchant.image);
    const logo = safeAssetUrl(merchant.logo);
    const category = escapeHtml(categoryLabel(merchant.category));
    const initials = escapeHtml(String(merchant.name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'LOCAL');
    return [
      '<div class="local-merchant-media">',
      image
        ? `<img class="local-merchant-photo" src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async"/>`
        : `<div class="local-merchant-placeholder" aria-hidden="true"><span>${initials}</span></div>`,
      '<div class="local-merchant-media-overlay">',
      `<span class="local-merchant-category">${category}</span>`,
      logo ? `<img class="local-merchant-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(merchant.name)} logo" loading="lazy" decoding="async"/>` : '',
      '</div>',
      '</div>'
    ].join('');
  }

  function renderPerk(perk) {
    if (!perk) {
      return [
        '<div class="local-perk-state local-perk-state--quiet">',
        '<span>Perk status</span>',
        '<strong>No active offer right now</strong>',
        '<p>This business can remain discoverable while an offer is paused, scheduled or being refreshed.</p>',
        '</div>'
      ].join('');
    }
    return [
      '<div class="local-perk-state">',
      '<span>Current Local perk</span>',
      `<strong>${escapeHtml(perk.headline)}</strong>`,
      `<p>${escapeHtml(perk.summary)}</p>`,
      '</div>'
    ].join('');
  }

  function renderMerchantCard(viewModel) {
    if (!viewModel || !viewModel.merchant) throw new Error('merchant view model required');
    const m = viewModel.merchant;
    const website = safeExternalUrl(m.website_url);
    const instagram = safeExternalUrl(m.instagram_url);
    const classes = ['local-merchant-card'];
    if (m.featured) classes.push('local-merchant-card--featured');
    if (!viewModel.perk) classes.push('local-merchant-card--no-perk');
    const links = [];
    if (website) links.push(`<a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">Website <span aria-hidden="true">↗</span></a>`);
    if (instagram) links.push(`<a href="${escapeHtml(instagram)}" target="_blank" rel="noopener noreferrer">Instagram <span aria-hidden="true">↗</span></a>`);

    return [
      `<article class="${classes.join(' ')}" data-local-merchant="${escapeHtml(m.merchant_id)}" data-local-category="${escapeHtml(m.category)}">`,
      renderMerchantMedia(m),
      '<div class="local-merchant-body">',
      '<div class="local-merchant-meta">',
      `<span>${escapeHtml(m.neighborhood)}</span>`,
      m.featured ? '<span class="local-featured-badge">Featured</span>' : '',
      '</div>',
      `<h3>${escapeHtml(m.name)}</h3>`,
      `<p class="local-merchant-short">${escapeHtml(m.description_short)}</p>`,
      renderPerk(viewModel.perk),
      `<a class="local-merchant-open" href="${escapeHtml(viewModel.merchant_url)}" data-local-merchant-link data-local-partner-id="${escapeHtml(m.merchant_id)}" data-local-merchant-slug="${escapeHtml(m.slug)}" data-local-perk-id="${escapeHtml(viewModel.perk ? viewModel.perk.perk_id : '')}">${viewModel.perk ? 'View Local perk' : 'View business'} <span aria-hidden="true">→</span></a>`,
      '<details class="local-merchant-disclosure">',
      '<summary>View business details</summary>',
      '<div class="local-merchant-detail-panel">',
      `<p>${escapeHtml(m.description_long)}</p>`,
      `<p class="local-merchant-address"><strong>Area:</strong> ${escapeHtml(m.address_display)}</p>`,
      links.length ? `<div class="local-merchant-links">${links.join('')}</div>` : '',
      viewModel.perk ? `<p class="local-independent-offer">${escapeHtml(viewModel.perk.independent_offer_text)}</p>` : '',
      '</div>',
      '</details>',
      '</div>',
      '</article>'
    ].join('');
  }

  function renderEmptyState(category) {
    const key = CATEGORY_META[category] ? category : 'all';
    const isAll = key === 'all';
    return [
      '<div class="local-directory-empty" role="status">',
      '<div class="local-directory-empty-mark" aria-hidden="true">408</div>',
      `<h3>${isAll ? 'The directory is ready for the pilot.' : `No active ${escapeHtml(categoryLabel(key))} merchants yet.`}</h3>`,
      `<p>${escapeHtml(CATEGORY_META[key].empty)}</p>`,
      '<p class="local-directory-empty-note">Only active, non-fixture merchant records can appear here. Draft, paused and inactive merchants stay hidden automatically.</p>',
      '</div>'
    ].join('');
  }

  function renderDirectory(viewModels, category) {
    const filtered = filterViewModels(viewModels, category);
    return filtered.length ? filtered.map(renderMerchantCard).join('') : renderEmptyState(category);
  }

  function getSummary(viewModels, category) {
    const filtered = filterViewModels(viewModels, category);
    const activePerks = filtered.filter((vm) => Boolean(vm.perk)).length;
    return {
      merchants: filtered.length,
      activePerks,
      text: filtered.length
        ? `${filtered.length} active ${filtered.length === 1 ? 'business' : 'businesses'} · ${activePerks} current ${activePerks === 1 ? 'perk' : 'perks'}`
        : 'Pilot merchant offers are being prepared.'
    };
  }

  function initDirectory(doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null);
    if (!documentRef || !LocalDataModel) return Promise.resolve(null);
    const root = documentRef.querySelector('[data-local-directory]');
    if (!root) return Promise.resolve(null);
    const grid = root.querySelector('[data-local-directory-grid]');
    const status = root.querySelector('[data-local-directory-status]');
    const filters = Array.from(root.querySelectorAll('[data-local-filter]'));
    let viewModels = [];
    let activeCategory = 'all';

    function paint() {
      grid.innerHTML = renderDirectory(viewModels, activeCategory);
      if (LocalAttribution && typeof LocalAttribution.decorateScope === 'function') LocalAttribution.decorateScope(grid);
      grid.setAttribute('aria-busy', 'false');
      const summary = getSummary(viewModels, activeCategory);
      if (status) status.textContent = summary.text;
      filters.forEach((button) => {
        const selected = button.getAttribute('data-local-filter') === activeCategory;
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        button.classList.toggle('is-active', selected);
      });
    }

    filters.forEach((button) => {
      button.addEventListener('click', () => {
        activeCategory = button.getAttribute('data-local-filter') || 'all';
        paint();
      });
    });

    return LocalDataModel.loadCatalog('/local/data/catalog.json')
      .then((catalog) => {
        viewModels = getDirectoryViewModels(catalog);
        root.setAttribute('data-local-directory-state', 'ready');
        paint();
        return viewModels;
      })
      .catch(() => {
        root.setAttribute('data-local-directory-state', 'error');
        grid.setAttribute('aria-busy', 'false');
        grid.innerHTML = [
          '<div class="local-directory-empty local-directory-empty--error" role="alert">',
          '<h3>Local directory temporarily unavailable.</h3>',
          '<p>Please try again later. Insurance reviews elsewhere on 408FARMERS are unaffected.</p>',
          '</div>'
        ].join('');
        if (status) status.textContent = 'Directory temporarily unavailable.';
        return [];
      });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initDirectory(document));
    else initDirectory(document);
  }

  return Object.freeze({
    CATEGORY_META,
    safeAssetUrl,
    getDirectoryViewModels,
    filterViewModels,
    renderMerchantCard,
    renderEmptyState,
    renderDirectory,
    getSummary,
    initDirectory
  });
});
