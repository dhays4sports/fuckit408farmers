(function (root, factory) {
  'use strict';
  var api = factory();
  root.Farmers408CampaignEntryRegistry = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var BUILD = '408-UI-3.11.1';
  var VERSION = '1.0.0';

  var ENTRIES = Object.freeze({
    stevies_coaster_home_front: Object.freeze({
      id: 'stevies_coaster_home_front',
      family: 'home',
      route: '/home/',
      visualMode: 'ui3_home',
      copy: Object.freeze({
        eyebrow: 'South Bay home coverage review',
        title: 'Own a Home in the South Bay?',
        lead: 'Before your next renewal, see whether your coverage may deserve another look.',
        body: 'Start with a short coverage review, then Dylan can help you compare what still fits and what may be worth reviewing.',
        cta: 'Start My Coverage Review',
        reassurance: 'One local agent. No call-center barrage. No obligation. No pressure.'
      })
    }),
    stevies_coaster_bundle_back: Object.freeze({
      id: 'stevies_coaster_bundle_back',
      family: 'home_auto',
      route: '/auto-bundle/',
      visualMode: 'ui3_bundle',
      copy: Object.freeze({
        eyebrow: 'Home + auto coverage review',
        title: 'Own the Home. Drive the Cars.',
        lead: 'Review them together. Home + auto coverage reviewed with one local producer.',
        formKicker: 'Home + auto review',
        formTitle: 'Start your home + auto review',
        submit: 'Start My Home + Auto Review'
      })
    }),
    occupation_tech_meta_v1: Object.freeze({
      id: 'occupation_tech_meta_v1', family: 'professional', route: '/tech/', visualMode: 'ui3_professional',
      copy: Object.freeze({ eyebrow: 'Technology professionals', title: 'Work in Tech?', lead: 'Your profession may qualify for additional insurance discounts. Dylan verifies availability during quoting and underwriting.', formKicker: 'Professional Discount Eligibility Review', formTitle: 'Check your professional eligibility', submit: 'Check My Eligibility' })
    }),
    occupation_teacher_meta_v1: Object.freeze({
      id: 'occupation_teacher_meta_v1', family: 'professional', route: '/teachers/', visualMode: 'ui3_professional',
      copy: Object.freeze({ eyebrow: 'Educators', title: 'Are You a Teacher?', lead: 'See whether your profession may qualify for educator-related insurance discounts. Dylan verifies availability during quoting and underwriting.', formKicker: 'Educator Discount Eligibility Review', formTitle: 'Check your educator eligibility', submit: 'Check My Eligibility' })
    }),
    occupation_engineer_meta_v1: Object.freeze({
      id: 'occupation_engineer_meta_v1', family: 'professional', route: '/engineers/', visualMode: 'ui3_professional',
      copy: Object.freeze({ eyebrow: 'Engineering professionals', title: 'Are You an Engineer?', lead: 'Your profession may qualify for additional insurance discounts. Dylan verifies availability during quoting and underwriting.', formKicker: 'Professional Discount Eligibility Review', formTitle: 'Check your professional eligibility', submit: 'Check My Eligibility' })
    }),
    occupation_healthcare_meta_v1: Object.freeze({
      id: 'occupation_healthcare_meta_v1', family: 'professional', route: '/healthcare/', visualMode: 'ui3_professional',
      copy: Object.freeze({ eyebrow: 'Healthcare professionals', title: 'Work in Healthcare?', lead: 'See whether your profession may qualify for additional insurance discounts. Dylan verifies availability during quoting and underwriting.', formKicker: 'Professional Discount Eligibility Review', formTitle: 'Check your professional eligibility', submit: 'Check My Eligibility' })
    }),
    realtor_buyer_card: Object.freeze({
      id: 'realtor_buyer_card', family: 'buyer', route: '/buyer/', visualMode: 'ui3_buyer',
      copy: Object.freeze({ kicker: 'Buying a home', title: 'Need Coverage for Your Closing?', lead: 'Let’s organize the insurance side while your purchase keeps moving.', body: 'Share the property and closing timeline once. CoverageFit organizes the next questions so Dylan can review the coverage side with the right context.', startOnline: 'Start My Buyer Review' })
    }),
    life_before_changes: Object.freeze({ id: 'life_before_changes', family: 'life', route: '/life/', visualMode: 'life_campaign', lifeVariant: 'before_anything_changes' }),
    life_this_is_the_time: Object.freeze({ id: 'life_this_is_the_time', family: 'life', route: '/life/', visualMode: 'life_campaign', lifeVariant: 'this_is_the_time' }),
    life_20_minutes: Object.freeze({ id: 'life_20_minutes', family: 'life', route: '/life/', visualMode: 'life_campaign', lifeVariant: '20_minutes' }),
    life_financial_picture: Object.freeze({ id: 'life_financial_picture', family: 'life', route: '/life/', visualMode: 'life_campaign', lifeVariant: 'financial_picture' })
  });

  var PRO_ALIASES = Object.freeze({
    '/tech/': Object.freeze(['occupation_tech_meta_v1', 'tech_meta_v1', 'tech_eligibility', 'tech_v1']),
    '/teachers/': Object.freeze(['occupation_teacher_meta_v1', 'teacher_meta_v1', 'teacher_eligibility', 'teacher_v1', 'educator_v1']),
    '/engineers/': Object.freeze(['occupation_engineer_meta_v1', 'engineer_meta_v1', 'engineer_eligibility', 'engineer_v1']),
    '/healthcare/': Object.freeze(['occupation_healthcare_meta_v1', 'healthcare_meta_v1', 'healthcare_eligibility', 'healthcare_v1'])
  });

  var LIFE_ALIASES = Object.freeze({
    before_anything_changes: 'life_before_changes', before_anything_changes_ad: 'life_before_changes', creative_a: 'life_before_changes', a: 'life_before_changes',
    this_is_the_time: 'life_this_is_the_time', creative_c: 'life_this_is_the_time', c: 'life_this_is_the_time',
    '20_minutes': 'life_20_minutes', '20_minute': 'life_20_minutes', '20minutes': 'life_20_minutes', creative_b: 'life_20_minutes', b: 'life_20_minutes',
    financial_picture: 'life_financial_picture', health_financial_picture: 'life_financial_picture', creative_d: 'life_financial_picture', d: 'life_financial_picture'
  });

  function clean(value, max) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 160);
  }

  function token(value) {
    return clean(value, 160).toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  function route(pathname) {
    var p = clean(pathname || '/', 240).split('?')[0] || '/';
    if (!p.startsWith('/')) p = '/' + p;
    p = p.replace(/\/{2,}/g, '/');
    if (!/\.[a-z0-9]+$/i.test(p) && !p.endsWith('/')) p += '/';
    return p;
  }

  function params(search) {
    var out = {};
    var p;
    try { p = new URLSearchParams(String(search || '')); } catch (_) { p = new URLSearchParams(''); }
    ['source','surface','campaign','variant','campaign_id','campaign_variant','campaign_zip','creative','utm_source','utm_medium','utm_campaign','utm_content','utm_term','partner_id','partner_name','partner','realtor_id','realtor_name','referred_by'].forEach(function (key) {
      var values = p.getAll(key);
      if (values.length === 1) out[key] = clean(values[0], key === 'partner_name' || key === 'realtor_name' || key === 'referred_by' ? 80 : 160);
    });
    return out;
  }

  function hasAnyToken(raw, values) {
    var candidates = [raw.campaign_id, raw.campaign, raw.campaign_variant, raw.variant, raw.utm_content, raw.creative];
    var allowed = values.map(token);
    return candidates.some(function (candidate) { return allowed.indexOf(token(candidate)) !== -1; });
  }

  function explicitSignal(raw) {
    return Object.keys(raw || {}).length > 0;
  }

  function resolve(locationLike) {
    var value = locationLike && typeof locationLike === 'object' ? locationLike : {};
    var pathname = route(value.pathname || '/');
    var raw = params(value.search || '');

    /* Dynamic existing flyer family: preserve the established 408-HOME renderer. */
    var flyerPath = pathname.match(/^\/home\/(?:qr|campaign)\/(\d{5})\/(rate|fit)\/$/i);
    if (flyerPath || (pathname === '/home/' && /^\d{5}$/.test(raw.campaign_zip || '') && /^(?:rate|fit|a|b)$/i.test(raw.campaign_variant || ''))) {
      return Object.freeze({ active: true, delegated: true, id: 'home_flyer_dynamic', family: 'home', route: pathname, visualMode: 'ui3_home', raw: Object.freeze(raw) });
    }

    if (pathname === '/home/') {
      var homeId = token(raw.campaign_id || raw.campaign);
      var source = token(raw.utm_source || raw.source);
      var medium = token(raw.utm_medium);
      var content = token(raw.utm_content || raw.variant || raw.campaign_variant);
      if (homeId === 'stevies_coaster_home_front' || (source === 'stevies' && medium === 'coaster' && content === 'home_front')) {
        return Object.freeze({ active: true, delegated: false, id: 'stevies_coaster_home_front', family: 'home', route: pathname, visualMode: ENTRIES.stevies_coaster_home_front.visualMode, entry: ENTRIES.stevies_coaster_home_front, raw: Object.freeze(raw) });
      }
    }

    if (pathname === '/auto-bundle/') {
      var bundleId = token(raw.campaign_id || raw.campaign);
      var bundleSource = token(raw.utm_source || raw.source);
      var bundleMedium = token(raw.utm_medium);
      var bundleContent = token(raw.utm_content || raw.variant || raw.campaign_variant);
      if (bundleId === 'stevies_coaster_bundle_back' || (bundleSource === 'stevies' && bundleMedium === 'coaster' && bundleContent === 'bundle_back')) {
        return Object.freeze({ active: true, delegated: false, id: 'stevies_coaster_bundle_back', family: 'home_auto', route: pathname, visualMode: ENTRIES.stevies_coaster_bundle_back.visualMode, entry: ENTRIES.stevies_coaster_bundle_back, raw: Object.freeze(raw) });
      }
    }

    if (PRO_ALIASES[pathname] && hasAnyToken(raw, PRO_ALIASES[pathname])) {
      var canonical = PRO_ALIASES[pathname][0];
      return Object.freeze({ active: true, delegated: false, id: canonical, family: 'professional', route: pathname, visualMode: ENTRIES[canonical].visualMode, entry: ENTRIES[canonical], raw: Object.freeze(raw) });
    }

    if (pathname === '/buyer/') {
      var buyerId = token(raw.campaign_id || raw.campaign || raw.utm_content);
      var partnerExplicit = Boolean(clean(raw.partner_id || raw.partner || raw.realtor_id || raw.partner_name || raw.realtor_name || raw.referred_by, 100));
      var partnerCard = token(raw.utm_medium) === 'partner_card';
      if (buyerId === 'realtor_buyer_card' || partnerExplicit || partnerCard) {
        return Object.freeze({ active: true, delegated: false, id: 'realtor_buyer_card', family: 'buyer', route: pathname, visualMode: ENTRIES.realtor_buyer_card.visualMode, entry: ENTRIES.realtor_buyer_card, raw: Object.freeze(raw) });
      }
    }

    if (pathname === '/life/' && explicitSignal(raw)) {
      var lifeCandidates = [raw.campaign_variant, raw.utm_content, raw.creative, raw.campaign_id, raw.campaign];
      for (var i = 0; i < lifeCandidates.length; i += 1) {
        var lifeKey = token(lifeCandidates[i]);
        var lifeId = LIFE_ALIASES[lifeKey];
        if (lifeId) return Object.freeze({ active: true, delegated: true, id: lifeId, family: 'life', route: pathname, visualMode: 'life_campaign', entry: ENTRIES[lifeId], raw: Object.freeze(raw) });
      }
    }

    return Object.freeze({ active: false, delegated: false, id: '', family: '', route: pathname, visualMode: '', raw: Object.freeze(raw) });
  }

  function publicEntries() {
    return Object.keys(ENTRIES).map(function (key) { return ENTRIES[key]; });
  }

  return Object.freeze({ BUILD: BUILD, VERSION: VERSION, ENTRIES: ENTRIES, PRO_ALIASES: PRO_ALIASES, LIFE_ALIASES: LIFE_ALIASES, clean: clean, token: token, route: route, params: params, resolve: resolve, publicEntries: publicEntries });
});
