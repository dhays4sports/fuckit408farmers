(() => {
  'use strict';

  const VERSION = '1.0';
  const STORAGE_KEY = 'coveragefit_personalization_context_v1';
  const PROFILE_KEY = 'coveragefit_prospect_profile_v1';
  const ATTRIBUTION_SESSION_KEY = 'coveragefit_attribution_session_v1';
  const SESSION_ID_KEY = 'coveragefit_session_id_v1';

  const clean = (value, max = 220) => String(value || '')
    .trim()
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, max);

  const cleanEmail = (value) => clean(value, 254).toLowerCase();
  const cleanPhone = (value) => clean(value, 40).replace(/[^0-9+().\-\s]/g, '');

  const readJson = (storage, key) => {
    try { return JSON.parse(storage.getItem(key) || 'null'); } catch (_) { return null; }
  };

  const writeJson = (storage, key, value) => {
    try { storage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  };

  const deepFreeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  };

  const normalizeReviewReason = (value) => clean(value, 160)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  const reasonKeyFor = (value) => {
    const context = normalizeReviewReason(value);
    if (!context) return 'general';
    if (/\bnon[\s-]*renew|not\s+(?:being\s+)?renew|coverage\s+(?:is\s+)?ending|carrier\s+(?:is\s+)?leaving|cancel(?:led|ation)?\b/.test(context)) return 'non-renewal';
    if (/\bhomebuyer\b|buying|purchas|new home|closing|escrow/.test(context)) return 'homebuyer';
    if (/premium|rate increase|price increase|cost increase|rates? went up|premium went up/.test(context)) return 'premium-increase';
    if (/renew|annual review/.test(context)) return 'renewal';
    if (/remodel|renovat/.test(context)) return 'remodel';
    if (/family|baby|child/.test(context)) return 'new-family';
    if (/rental|landlord/.test(context)) return 'landlord';
    return 'general';
  };

  const isUsableAddress = (value) => {
    const address = clean(value, 220);
    if (address.length < 5 || !/[a-z]/i.test(address)) return false;
    if (/^(?:n\/?a|none|unknown|not provided|not available|tbd)$/i.test(address)) return false;
    if (/^\d{5}(?:-\d{4})?$/.test(address)) return false;
    if (/https?:\/\/|@/.test(address)) return false;
    return true;
  };

  const assembleAddress = (profile, prior) => {
    const address = profile?.address || {};
    const direct = clean(profile?.propertyAddress || address.formattedAddress || prior?.property?.displayAddress, 220);
    if (isUsableAddress(direct)) return direct;

    const street = clean(address.street || prior?.property?.street, 160);
    const city = clean(address.city || prior?.property?.city, 100);
    const state = clean(address.state || prior?.property?.state, 40);
    const postalCode = clean(address.postalCode || prior?.property?.postalCode, 20);
    if (!street) return '';
    const locality = [city, state].filter(Boolean).join(', ');
    const assembled = [street, [locality, postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return isUsableAddress(assembled) ? assembled : '';
  };

  const referrerHost = () => {
    try {
      const value = clean(document?.referrer, 300);
      if (!value) return '';
      return clean(new URL(value, window.location.origin).hostname, 160);
    } catch (_) {
      return '';
    }
  };

  const profileFromStorage = () => {
    const runtimeProfile = window.CoverageFitPrefill?.get?.() || null;
    const sessionProfile = readJson(sessionStorage, PROFILE_KEY);
    if (sessionProfile) return { profile: sessionProfile, scope: 'session' };
    if (runtimeProfile) {
      const localProfile = readJson(localStorage, PROFILE_KEY);
      return { profile: runtimeProfile, scope: localProfile ? 'local' : 'runtime' };
    }
    const localProfile = readJson(localStorage, PROFILE_KEY);
    return { profile: localProfile, scope: localProfile ? 'local' : 'none' };
  };

  const attributionFromRuntime = () => {
    const current = window.CoverageFitAttribution?.get?.() || null;
    const payload = window.CoverageFitAttribution?.getPayload?.()
      || readJson(sessionStorage, ATTRIBUTION_SESSION_KEY)
      || null;
    return { current, payload };
  };

  const build = () => {
    const profileRecord = profileFromStorage();
    let profile = profileRecord.profile;
    let profileScope = profileRecord.scope;
    const attribution = attributionFromRuntime();
    const previous = readJson(sessionStorage, STORAGE_KEY);
    const currentAttribution = attribution.current || {};
    const payload = attribution.payload || {};

    let generatedSessionId = '';
    try { generatedSessionId = clean(sessionStorage.getItem(SESSION_ID_KEY), 120); } catch (_) {}

    const activeAttributionSession = clean(currentAttribution.sessionId || payload.sessionId || generatedSessionId, 120);
    const storedProfileSession = clean(profile?.integration?.sessionId, 120);
    if (profileScope === 'local' && activeAttributionSession && storedProfileSession && activeAttributionSession !== storedProfileSession) {
      profile = null;
      profileScope = 'none';
    }
    const integration = profile?.integration || {};
    const sessionId = clean(
      integration.sessionId
      || activeAttributionSession
      || previous?.sessionId,
      120
    );
    const canReusePrevious = Boolean(previous && (!previous.sessionId || !sessionId || previous.sessionId === sessionId));
    const prior = canReusePrevious ? previous : null;

    const givenName = clean(profile?.firstName || prior?.identity?.givenName, 80);
    const familyName = clean(profile?.lastName || prior?.identity?.familyName, 80);
    const displayName = clean(
      profile?.fullName
      || [givenName, familyName].filter(Boolean).join(' ')
      || prior?.identity?.displayName,
      160
    );
    const reviewReason = clean(profile?.reviewContext || prior?.journey?.reviewReason, 160);
    const reasonKey = reasonKeyFor(reviewReason || prior?.journey?.reasonKey);
    const displayAddress = assembleAddress(profile, prior);
    const sourceAddress = profile?.address || {};
    const lastTouch = payload.lastTouch || currentAttribution.lastTouch || {};
    const firstTouch = payload.firstTouch || currentAttribution.firstTouch || {};

    const source = clean(
      integration.source
      || currentAttribution.source
      || lastTouch.source
      || lastTouch.utm_source
      || firstTouch.source
      || firstTouch.utm_source
      || prior?.journey?.source
      || 'direct',
      100
    );
    const campaign = clean(
      integration.campaign
      || currentAttribution.campaign
      || lastTouch.campaign
      || lastTouch.utm_campaign
      || firstTouch.campaign
      || firstTouch.utm_campaign
      || prior?.journey?.campaign,
      180
    );
    const referralSource = clean(
      integration.referralSource
      || lastTouch.ref
      || firstTouch.ref
      || prior?.journey?.referralSource
      || referrerHost(),
      180
    );
    const entryPoint = clean(
      integration.entry
      || currentAttribution.entry
      || lastTouch.entry
      || firstTouch.entry
      || firstTouch.path
      || prior?.journey?.entryPoint,
      140
    );
    const assessment = clean(
      integration.assessment
      || currentAttribution.assessment
      || lastTouch.assessment
      || firstTouch.assessment
      || prior?.journey?.assessment
      || 'home',
      80
    );
    const medium = clean(
      currentAttribution.medium
      || lastTouch.medium
      || lastTouch.utm_medium
      || firstTouch.medium
      || firstTouch.utm_medium
      || prior?.journey?.medium,
      80
    );

    const normalized = {
      version: VERSION,
      sessionId,
      identity: {
        givenName,
        familyName,
        displayName
      },
      contact: {
        email: cleanEmail(profile?.email || prior?.contact?.email),
        phone: cleanPhone(profile?.phone || prior?.contact?.phone)
      },
      property: {
        displayAddress,
        street: clean(sourceAddress.street || prior?.property?.street, 160),
        city: clean(sourceAddress.city || prior?.property?.city, 100),
        county: clean(sourceAddress.county || prior?.property?.county, 100),
        state: clean(sourceAddress.state || prior?.property?.state, 40),
        postalCode: clean(sourceAddress.postalCode || prior?.property?.postalCode, 20),
        country: clean(sourceAddress.country || prior?.property?.country || 'US', 40),
        placeId: clean(sourceAddress.placeId || prior?.property?.placeId, 180),
        selectionMethod: clean(sourceAddress.selectionMethod || prior?.property?.selectionMethod, 40)
      },
      journey: {
        reviewReason,
        reasonKey,
        source,
        campaign,
        referralSource,
        entryPoint,
        assessment,
        medium,
        handoffVersion: clean(integration.handoffVersion || prior?.journey?.handoffVersion, 20),
        prefilled: Boolean(profile && integration.prefilled !== false)
      },
      flags: {
        hasProfile: Boolean(profile),
        hasName: Boolean(displayName),
        hasAddress: Boolean(displayAddress),
        hasAttribution: Boolean(campaign || referralSource || entryPoint || source !== 'direct')
      },
      provenance: {
        profileScope: profile ? profileScope : 'none',
        attributionAvailable: Boolean(attribution.current || attribution.payload),
        normalizedAt: new Date().toISOString(),
        receivedAt: clean(profile?.receivedAt || prior?.provenance?.receivedAt, 40)
      }
    };

    writeJson(sessionStorage, STORAGE_KEY, normalized);
    return deepFreeze(normalized);
  };

  let context = build();

  const api = {
    version: VERSION,
    storageKey: STORAGE_KEY,
    get: () => context,
    refresh: () => {
      context = build();
      try {
        window.dispatchEvent(new CustomEvent('coveragefit:personalization-ready', {
          detail: {
            version: VERSION,
            reasonKey: context.journey.reasonKey,
            hasName: context.flags.hasName,
            hasAddress: context.flags.hasAddress,
            hasAttribution: context.flags.hasAttribution,
            sessionId: context.sessionId
          }
        }));
      } catch (_) {}
      return context;
    },
    reasonKeyFor,
    clear: () => {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
      context = deepFreeze({
        version: VERSION,
        sessionId: '',
        identity: { givenName: '', familyName: '', displayName: '' },
        contact: { email: '', phone: '' },
        property: { displayAddress: '', street: '', city: '', county: '', state: '', postalCode: '', country: '', placeId: '', selectionMethod: '' },
        journey: { reviewReason: '', reasonKey: 'general', source: 'direct', campaign: '', referralSource: '', entryPoint: '', assessment: 'home', medium: '', handoffVersion: '', prefilled: false },
        flags: { hasProfile: false, hasName: false, hasAddress: false, hasAttribution: false },
        provenance: { profileScope: 'none', attributionAvailable: false, normalizedAt: new Date().toISOString(), receivedAt: '' }
      });
      return context;
    }
  };

  window.CoverageFitPersonalization = Object.freeze(api);

  try {
    window.dispatchEvent(new CustomEvent('coveragefit:personalization-ready', {
      detail: {
        version: VERSION,
        reasonKey: context.journey.reasonKey,
        hasName: context.flags.hasName,
        hasAddress: context.flags.hasAddress,
        hasAttribution: context.flags.hasAttribution,
        sessionId: context.sessionId
      }
    }));
  } catch (_) {}
})();
