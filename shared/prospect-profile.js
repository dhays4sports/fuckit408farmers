(function (window) {
  'use strict';

  var STORAGE_KEY = 'coveragefit_prospect_profile_v1';
  var LEAD_CHECKPOINT_KEY = '408farmers_discovery_lead_checkpoint_id_v1';
  var VERSION = '2.0';

  function trim(value) {
    return value === undefined || value === null ? '' : String(value).replace(/\s+/g, ' ').trim();
  }

  function normalizeEmail(value) {
    return trim(value).toLowerCase();
  }

  function normalizePhone(value) {
    var digits = trim(value).replace(/\D/g, '');
    if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
    return digits;
  }

  function field(form, name) {
    if (!form || !form.elements || !form.elements[name]) return '';
    return trim(form.elements[name].value);
  }

  function safeStorage() {
    try {
      var storage = window.sessionStorage;
      var probe = '__cf_profile_probe__';
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return storage;
    } catch (error) {
      return null;
    }
  }

  function leadCheckpointId() {
    var session = safeStorage();
    var local = null;
    try { local = window.localStorage; } catch (_) {}
    var existing = '';
    try { existing = (session && session.getItem(LEAD_CHECKPOINT_KEY)) || (local && local.getItem(LEAD_CHECKPOINT_KEY)) || ''; } catch (_) {}
    if (/^408d_[A-Za-z0-9_-]{16,80}$/.test(existing)) return existing;
    var suffix = '';
    if (window.crypto && typeof window.crypto.randomUUID === 'function') suffix = window.crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    else suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 18);
    var created = '408d_' + suffix;
    try { if (session) session.setItem(LEAD_CHECKPOINT_KEY, created); if (local) local.setItem(LEAD_CHECKPOINT_KEY, created); } catch (_) {}
    return created;
  }

  function discoveryAnswers(form) {
    var reason = { farmers_fit:'renewal_increase', coverage_fit:'something_else', home_auto_bundle:'something_else', exploring:'comparison' }[field(form, 'home_review_goal')] || '';
    if (field(form, 'housing_context') === 'buyer') reason = 'buying_home';
    var priority = { shopping_now:'understanding', renewal_60:'claim_support', later:'agent_access', coordination:'coordination', price_only:'price_only', not_sure:'not_sure' }[field(form, 'review_timing')] || '';
    return { shoppingReason: reason, improvementPriorities: priority ? [priority] : [] };
  }

  function readAttribution() {
    if (window.CoverageFitLauncher && typeof window.CoverageFitLauncher.getAttribution === 'function') {
      return window.CoverageFitLauncher.getAttribution() || {};
    }
    return {};
  }

  function getSessionId() {
    if (window.CoverageFitLauncher && typeof window.CoverageFitLauncher.getSessionId === 'function') {
      return window.CoverageFitLauncher.getSessionId();
    }
    return '';
  }

  function build(form) {
    var firstName = field(form, 'first_name');
    var lastName = field(form, 'last_name');
    var formattedAddress = field(form, 'property_formatted_address');
    var typedAddress = field(form, 'property_address');
    var attribution = readAttribution();
    var source = field(form, 'source') || '408farmers';
    var campaign = field(form, 'campaign') || attribution.campaign || 'direct';

    var discovery = discoveryAnswers(form);
    var profile = {
      version: VERSION,
      firstName: firstName,
      lastName: lastName,
      fullName: trim(firstName + ' ' + lastName),
      phone: normalizePhone(field(form, 'phone')),
      email: normalizeEmail(field(form, 'email')),
      propertyAddress: formattedAddress || typedAddress,
      reviewContext: field(form, 'review_context') || field(form, 'segment'),
      homeReviewGoal: field(form, 'home_review_goal'),
      occupationSegment: field(form, 'occupation_segment'),
      housingContext: field(form, 'housing_context'),
      bundleStatus: field(form, 'bundle_status'),
      reviewTiming: field(form, 'review_timing'),
      closingDate: field(form, 'closing_date'),
      occupancy: field(form, 'occupancy'),
      closingUrgency: field(form, 'closing_urgency'),
      partnerId: field(form, 'partner_id'),
      referralSource: field(form, 'referral_source'),
      source: source,
      campaign: campaign,
      campaignId: field(form, 'campaign_id') || attribution.campaign_id || '',
      campaignVariant: field(form, 'campaign_variant') || attribution.campaign_variant || '',
      campaignZip: field(form, 'campaign_zip') || attribution.campaign_zip || '',
      utm: {
        source: field(form, 'utm_source') || attribution.utm_source || '',
        medium: field(form, 'utm_medium') || attribution.utm_medium || '',
        campaign: field(form, 'utm_campaign') || attribution.utm_campaign || '',
        content: field(form, 'utm_content') || attribution.utm_content || '',
        term: field(form, 'utm_term') || attribution.utm_term || ''
      },
      sessionId: getSessionId(),
      leadCheckpointId: leadCheckpointId(),
      discovery: {
        schemaVersion: '1.0', productTrack: field(form, 'housing_context') === 'buyer' ? 'buyer' : field(form, 'housing_context') === 'renter' ? 'renter' : field(form, 'home_review_goal') === 'home_auto_bundle' ? 'bundle' : 'home',
        answers: discovery, exactCustomerWords: { shoppingReason: field(form, 'review_context') }, answerSources: { shoppingReason: '408farmers_web', improvementPriorities: '408farmers_web' }
      },
      contactPermission: {
        confirmed: Boolean(form && form.elements && form.elements.consent && form.elements.consent.checked),
        status: form && form.elements && form.elements.consent && form.elements.consent.checked ? 'confirmed' : 'unverified',
        basis: '408farmers_optional_progressive_checkpoint_checkbox',
        capturedAt: field(form, 'contact_consent_timestamp') || field(form, 'submitted_at'),
        version: field(form, 'contact_consent_version') || '408farmers-agency-contact-v2',
        automatedSmsAuthorized: Boolean(form && form.elements && form.elements.automated_marketing_sms_consent && form.elements.automated_marketing_sms_consent.checked),
        automatedMarketingSms: {
          granted: Boolean(form && form.elements && form.elements.automated_marketing_sms_consent && form.elements.automated_marketing_sms_consent.checked),
          version: field(form, 'automated_marketing_sms_consent_version'),
          capturedAt: field(form, 'automated_marketing_sms_consent_timestamp'),
          seller: 'Virginia Tam Insurance Agency, Inc.',
          scope: 'recurring_automated_insurance_marketing_texts'
        }
      },
      createdAt: new Date().toISOString()
    };

    profile.address = {
      formattedAddress: profile.propertyAddress,
      street: field(form, 'property_street'),
      city: field(form, 'property_city'),
      county: field(form, 'property_county'),
      state: field(form, 'property_state'),
      postalCode: field(form, 'property_zip'),
      country: field(form, 'property_country'),
      placeId: field(form, 'property_place_id'),
      selectionMethod: field(form, 'address_selection_method') || 'manual'
    };

    return profile;
  }

  function save(profile) {
    var storage = safeStorage();
    if (!storage || !profile) return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(profile));
      return true;
    } catch (error) {
      return false;
    }
  }

  function load() {
    var storage = safeStorage();
    if (!storage) return null;
    try {
      var value = storage.getItem(STORAGE_KEY);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  function clear() {
    var storage = safeStorage();
    if (!storage) return false;
    try {
      storage.removeItem(STORAGE_KEY);
      storage.removeItem(LEAD_CHECKPOINT_KEY);
      try { window.localStorage.removeItem(LEAD_CHECKPOINT_KEY); } catch (_) {}
      return true;
    } catch (error) {
      return false;
    }
  }

  window.ProspectProfileBuilder = {
    version: VERSION,
    storageKey: STORAGE_KEY,
    fromForm: build,
    save: save,
    load: load,
    clear: clear,
    leadCheckpointId: leadCheckpointId,
    normalizePhone: normalizePhone,
    normalizeEmail: normalizeEmail
  };
})(window);
