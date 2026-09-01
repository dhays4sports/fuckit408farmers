/* 408-UI-3.11.1 — campaign-aware presentation only. Reads current URL; never uses persisted attribution to choose copy. */
(function (window, document) {
  'use strict';

  var registry = window.Farmers408CampaignEntryRegistry;
  if (!registry || !document || !document.body) return;

  function text(selector, value) {
    var node = document.querySelector(selector);
    if (node && value) node.textContent = value;
  }

  function mark(context) {
    document.body.dataset.campaignEntryBuild = registry.BUILD;
    document.body.dataset.campaignEntryActive = context.active ? 'true' : 'false';
    if (context.active) {
      document.body.dataset.campaignEntryId = context.id;
      document.body.dataset.campaignEntryFamily = context.family;
      document.body.dataset.campaignVisualMode = context.visualMode || '';
    }
  }

  function applyHome(entry) {
    var c = entry.copy;
    text('[data-home-campaign-eyebrow]', c.eyebrow);
    text('[data-home-campaign-title]', c.title);
    text('[data-home-campaign-lead]', c.lead);
    text('[data-home-campaign-copy]', c.body);
    text('[data-home-campaign-cta]', c.cta);
    text('[data-home-campaign-reassurance]', c.reassurance);
    var badge = document.querySelector('[data-home-campaign-badge]');
    if (badge) {
      badge.textContent = 'Connected from a 408FARMERS South Bay coaster';
      badge.hidden = false;
    }
  }

  function applyBundle(entry) {
    var c = entry.copy;
    text('[data-campaign-entry-eyebrow]', c.eyebrow);
    text('[data-campaign-entry-title]', c.title);
    text('[data-campaign-entry-lead]', c.lead);
    text('[data-campaign-entry-form-kicker]', c.formKicker);
    text('[data-campaign-entry-form-title]', c.formTitle);
    text('[data-campaign-entry-submit]', c.submit);
  }

  function applyProfessional(entry) {
    var c = entry.copy;
    text('[data-campaign-entry-eyebrow]', c.eyebrow);
    text('[data-campaign-entry-title]', c.title);
    text('[data-campaign-entry-lead]', c.lead);
    text('[data-campaign-entry-form-kicker]', c.formKicker);
    text('[data-campaign-entry-form-title]', c.formTitle);
    text('[data-campaign-entry-submit]', c.submit);
  }

  function applyBuyer(entry) {
    var c = entry.copy;
    text('[data-campaign-entry-kicker]', c.kicker);
    text('[data-campaign-entry-title]', c.title);
    text('[data-campaign-entry-lead]', c.lead);
    text('[data-campaign-entry-body]', c.body);
    text('[data-campaign-entry-start-online]', c.startOnline);
  }

  function init() {
    var context = registry.resolve(window.location || {});
    mark(context);
    if (!context.active || context.delegated || !context.entry) return;

    if (context.family === 'home') applyHome(context.entry);
    else if (context.family === 'home_auto') applyBundle(context.entry);
    else if (context.family === 'professional') applyProfessional(context.entry);
    else if (context.family === 'buyer') applyBuyer(context.entry);

    try {
      document.dispatchEvent(new CustomEvent('408farmers:campaign-entry-matched', {
        detail: { build: registry.BUILD, id: context.id, family: context.family, visualMode: context.visualMode }
      }));
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window, document);
