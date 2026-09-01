/* 408-LIFE-1.7 — paid-social message matching + privacy-safe attribution. Memory-only; no analytics or browser persistence. */
(function (window, document) {
  'use strict';

  var BUILD = '408-LIFE-1.7';
  var CAMPAIGN = 'life_insurability';
  var DEFAULT_VARIANT = 'before_anything_changes';
  var ATTR_KEYS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','campaign_id','campaign_variant','creative'];

  var VARIANTS = {
    before_anything_changes: {
      code: 'A',
      titleHtml: 'Before<br/>anything<br/><span>changes.</span>',
      titleText: 'Before anything changes.',
      lead: 'Life changes. Health changes. Eligibility can too.',
      support: 'Life insurance is something you want to take care of before you need it.',
      cta: 'See what you may qualify for today'
    },
    '20_minutes': {
      code: 'B',
      titleHtml: '<span>20:00</span>',
      titleText: '20:00.',
      lead: 'That is about how long it may take to complete your life insurance application.',
      support: 'You may spend longer tonight scrolling your phone. Potential same-day decision for eligible applicants.',
      cta: 'See what you may qualify for today'
    },
    this_is_the_time: {
      code: 'C',
      titleHtml: 'This is<br/>the <span>time.</span>',
      titleText: 'This is the time.',
      lead: 'Not after a diagnosis. Not after a health change. While life is normal.',
      support: 'Your age and health can affect life insurance eligibility and cost.',
      cta: 'Explore life insurance today'
    },
    financial_picture: {
      code: 'D',
      titleHtml: 'Your health<br/>is part of your<br/><span>financial picture.</span>',
      titleText: 'Your health is part of your financial picture.',
      lead: 'Life insurance can help protect the income, home, family or business that depends on you.',
      support: 'Start with a few quick questions, then get the application ready with Dylan.',
      cta: 'See my next step'
    }
  };

  var ALIASES = {
    a: 'before_anything_changes', creative_a: 'before_anything_changes', before_anything_changes: 'before_anything_changes', before_anything_changes_ad: 'before_anything_changes',
    b: '20_minutes', creative_b: '20_minutes', '20_minutes': '20_minutes', '20_minute': '20_minutes', '20minutes': '20_minutes',
    c: 'this_is_the_time', creative_c: 'this_is_the_time', this_is_the_time: 'this_is_the_time',
    d: 'financial_picture', creative_d: 'financial_picture', financial_picture: 'financial_picture', health_financial_picture: 'financial_picture'
  };

  function clean(value, max) {
    return String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 120);
  }

  function slug(value) {
    return clean(value, 120).toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  function readParams() {
    var params = new window.URLSearchParams(window.location.search || '');
    var out = {};
    ATTR_KEYS.forEach(function (key) {
      var value = clean(params.get(key), key === 'utm_term' ? 160 : 120);
      if (value) out[key] = value;
    });
    return out;
  }

  function resolveVariant(raw) {
    var candidates = [raw.campaign_variant, raw.utm_content, raw.creative];
    for (var i = 0; i < candidates.length; i += 1) {
      var key = slug(candidates[i]);
      if (ALIASES[key]) return ALIASES[key];
    }
    return DEFAULT_VARIANT;
  }

  function canonicalAttribution(raw, variant) {
    var cfg = VARIANTS[variant] || VARIANTS[DEFAULT_VARIANT];
    return Object.freeze({
      channel: 'life_campaign',
      landing_variant: variant,
      creative_code: cfg.code,
      utm_source: clean(raw.utm_source || 'direct', 120),
      utm_medium: clean(raw.utm_medium || (raw.utm_source ? 'paid_social' : 'direct'), 120),
      utm_campaign: clean(raw.utm_campaign || CAMPAIGN, 120),
      utm_content: clean(raw.utm_content || variant, 120),
      utm_term: clean(raw.utm_term, 160),
      campaign_id: clean(raw.campaign_id, 120),
      campaign_variant: clean(raw.campaign_variant || cfg.code, 40)
    });
  }

  var raw = readParams();
  var variant = resolveVariant(raw);
  var attribution = canonicalAttribution(raw, variant);

  function setText(selector, value) {
    var node = document.querySelector(selector);
    if (node) node.textContent = value;
  }

  function appendAttribution(link) {
    if (!link || !link.href) return;
    var url;
    try { url = new window.URL(link.href, window.location.origin); } catch (_) { return; }
    if (url.origin !== window.location.origin) return;
    if (!/\/contact\/?$/.test(url.pathname)) return;
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','campaign_id','campaign_variant'].forEach(function (key) {
      if (attribution[key] && !url.searchParams.has(key)) url.searchParams.set(key, attribution[key]);
    });
    link.href = url.pathname + url.search + url.hash;
  }

  function applyMessage() {
    if (!document.body || !document.body.classList.contains('life-page')) return;
    var cfg = VARIANTS[variant] || VARIANTS[DEFAULT_VARIANT];
    var title = document.querySelector('[data-life-hero-title]');
    if (title) {
      title.innerHTML = cfg.titleHtml;
      title.setAttribute('aria-label', cfg.titleText);
    }
    setText('[data-life-hero-lead]', cfg.lead);
    setText('[data-life-hero-support]', cfg.support);
    var cta = document.querySelector('[data-life-start]');
    if (cta) cta.innerHTML = cfg.cta + ' <span aria-hidden="true">→</span>';
    document.body.dataset.lifeCampaignVariant = variant;
    document.body.dataset.lifeCreativeCode = cfg.code;
    document.querySelectorAll('a[href*="/contact/"]').forEach(appendAttribution);
  }

  function snapshot() {
    return {
      channel: attribution.channel,
      landing_variant: attribution.landing_variant,
      creative_code: attribution.creative_code,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content: attribution.utm_content,
      utm_term: attribution.utm_term,
      campaign_id: attribution.campaign_id,
      campaign_variant: attribution.campaign_variant
    };
  }

  window.LifeCampaignAttribution = Object.freeze({
    build: BUILD,
    variant: variant,
    config: Object.freeze(VARIANTS[variant] || VARIANTS[DEFAULT_VARIANT]),
    snapshot: snapshot
  });

  function init() {
    applyMessage();
    if (document.body) document.body.dataset.lifeCampaignMatchingReady = 'true';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window, document);
