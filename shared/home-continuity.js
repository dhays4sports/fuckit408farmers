(function (root, factory) {
  'use strict';
  var api = factory(root);
  root.HomeJourneyContinuity = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var VERSION = '2.0.0';
  var BUILD = '408-DISCOVERY-1.0';
  var STORAGE_KEY = '408farmers_home_journey_continuity_v1';
  var TTL_MS = 6 * 60 * 60 * 1000;
  var STAGES = ['engagement', 'personalized_payoff', 'lead_capture', 'handoff_recovery'];
  var SEMANTIC = Object.freeze({
    homeReviewGoal: ['farmers_fit', 'coverage_fit', 'home_auto_bundle', 'exploring'],
    housingContext: ['owner_occupied', 'landlord', 'buyer', 'renter'],
    reviewTiming: ['shopping_now', 'renewal_60', 'later', 'coordination', 'price_only', 'not_sure']
  });
  var BRANCHES = Object.freeze({
    owner_occupied: Object.freeze({ key: 'owner_occupied', destinationType: 'coveragefit', destination: '/pvx/discovery/', propertyRequired: false, label: 'the home you own and live in' }),
    landlord: Object.freeze({ key: 'landlord', destinationType: 'coveragefit', destination: '/pvx/discovery/', propertyRequired: false, label: 'your rental property' }),
    buyer: Object.freeze({ key: 'buyer', destinationType: 'coveragefit', destination: '/pvx/discovery/', propertyRequired: false, label: 'the home you are buying' }),
    renter: Object.freeze({ key: 'renter', destinationType: 'coveragefit', destination: '/pvx/discovery/', propertyRequired: false, label: 'your renters review' })
  });

  function storage(value) {
    if (value) return value;
    try { return root.sessionStorage || null; } catch (_) { return null; }
  }

  function clean(value, max) {
    return String(value === undefined || value === null ? '' : value)
      .trim().replace(/[<>\u0000-\u001F\u007F]/g, '').slice(0, max || 120);
  }

  function bounded(value, allowed) {
    var candidate = clean(value, 60).toLowerCase();
    return allowed.indexOf(candidate) !== -1 ? candidate : '';
  }

  function clamp(value, minimum, maximum) {
    var number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? Math.max(minimum, Math.min(number, maximum)) : minimum;
  }

  function campaign(value) {
    var source = value && typeof value === 'object' ? value : {};
    var zip = /^\d{5}$/.test(clean(source.campaignZip, 10)) ? clean(source.campaignZip, 10) : '';
    var variant = bounded(source.campaignVariant, ['rate', 'fit']);
    var expected = zip && variant ? 'home_flyer_' + zip + '_' + variant : '';
    var supplied = clean(source.campaignId, 180).toLowerCase().replace(/-/g, '_');
    return expected && (!supplied || supplied === expected) ? { campaignId: expected, campaignZip: zip, campaignVariant: variant } : { campaignId: '', campaignZip: '', campaignVariant: '' };
  }

  function normalize(value, now) {
    var source = value && typeof value === 'object' ? value : {};
    var stage = bounded(source.stage, STAGES);
    if (!stage) return null;
    var updatedAt = clean(source.updatedAt, 40);
    var updated = Date.parse(updatedAt);
    var currentTime = Number.isFinite(now) ? now : Date.now();
    if (!Number.isFinite(updated) || currentTime - updated > TTL_MS || updated > currentTime + 60000) return null;
    var route = campaign(source);
    var housingContext = bounded(source.housingContext, SEMANTIC.housingContext);
    var branch = resolveBranch(housingContext);
    return Object.freeze({
      schemaVersion: '1.0',
      build: BUILD,
      stage: stage,
      engagementStep: clamp(source.engagementStep, 1, 3),
      leadStep: clamp(source.leadStep, 1, 2),
      homeReviewGoal: bounded(source.homeReviewGoal, SEMANTIC.homeReviewGoal),
      housingContext: housingContext,
      reviewTiming: bounded(source.reviewTiming, SEMANTIC.reviewTiming),
      branch: branch ? branch.key : '',
      destinationType: stage === 'handoff_recovery' && branch ? branch.destinationType : '',
      leadCaptureStatus: stage === 'handoff_recovery' ? bounded(source.leadCaptureStatus, ['confirmed', 'pending', 'unconfirmed', 'local-fallback']) : '',
      submittedAt: stage === 'handoff_recovery' ? clean(source.submittedAt, 40) : '',
      campaignId: route.campaignId,
      campaignZip: route.campaignZip,
      campaignVariant: route.campaignVariant,
      updatedAt: updatedAt,
      expiresAt: new Date(updated + TTL_MS).toISOString()
    });
  }

  function read(store, now) {
    var target = storage(store);
    if (!target) return null;
    var parsed = null;
    try { parsed = JSON.parse(target.getItem(STORAGE_KEY) || 'null'); } catch (_) {}
    var value = normalize(parsed, now);
    if (!value && parsed) {
      try { target.removeItem(STORAGE_KEY); } catch (_) {}
      var updated = Date.parse(parsed.updatedAt || '');
      var currentTime = Number.isFinite(now) ? now : Date.now();
      if (Number.isFinite(updated) && currentTime - updated > TTL_MS) {
        root.HomeJourneyBaseline?.emit?.(root.HomeJourneyContract?.EVENTS?.JOURNEY_EXPIRED, {
          stage: 'engagement',
          recovery_type: 'bounded_checkpoint_expired'
        }, { onceKey: 'journey_expired' });
      }
    }
    return value;
  }

  function write(input, store, now) {
    var target = storage(store);
    if (!target) return null;
    var currentTime = Number.isFinite(now) ? now : Date.now();
    var previous = read(target, currentTime) || {};
    var next = Object.assign({}, previous, input || {}, { updatedAt: new Date(currentTime).toISOString() });
    var normalized = normalize(next, currentTime);
    if (!normalized) return null;
    var safe = Object.assign({}, normalized);
    delete safe.expiresAt;
    try { target.setItem(STORAGE_KEY, JSON.stringify(safe)); } catch (_) { return null; }
    return normalized;
  }

  function clear(store) {
    try { storage(store)?.removeItem(STORAGE_KEY); } catch (_) {}
  }

  function resolveBranch(value) {
    var key = bounded(value, SEMANTIC.housingContext);
    return key && BRANCHES[key] ? BRANCHES[key] : null;
  }

  function fromForm(form, updates) {
    function field(name) { return form?.elements?.[name] ? form.elements[name].value : ''; }
    var currentCampaign = root.Farmers408FlyerCampaign?.getCurrent?.() || {};
    return Object.assign({
      homeReviewGoal: field('home_review_goal'),
      housingContext: field('housing_context'),
      reviewTiming: field('review_timing'),
      campaignId: field('campaign_id') || currentCampaign.campaignId,
      campaignZip: field('campaign_zip') || currentCampaign.campaignZip,
      campaignVariant: field('campaign_variant') || currentCampaign.campaignVariant
    }, updates || {});
  }

  function saveFromForm(form, updates, store, now) {
    return write(fromForm(form, updates), store, now);
  }

  function restoreForm(form, value) {
    var state = value || read();
    if (!form || !state) return null;
    var fields = {
      home_review_goal: state.homeReviewGoal,
      housing_context: state.housingContext,
      review_timing: state.reviewTiming
    };
    Object.keys(fields).forEach(function (name) {
      if (form.elements?.[name] && fields[name]) form.elements[name].value = fields[name];
    });
    var radios = {
      engagement_home_review_goal: state.homeReviewGoal,
      engagement_housing_context: state.housingContext,
      engagement_review_timing: state.reviewTiming
    };
    if (root.document?.querySelector) {
      Object.keys(radios).forEach(function (name) {
        if (!radios[name]) return;
        var radio = root.document.querySelector('input[name="' + name + '"][value="' + radios[name] + '"]');
        if (radio) radio.checked = true;
      });
    }
    return state;
  }

  function markHandoff(form, details, store, now) {
    return saveFromForm(form, Object.assign({ stage: 'handoff_recovery' }, details || {}), store, now);
  }

  function setHidden(node, hidden) {
    if (!node) return;
    node.hidden = Boolean(hidden);
    node.setAttribute?.('aria-hidden', hidden ? 'true' : 'false');
  }

  function renderRecovery() {
    if (!root.document?.querySelector) return null;
    var state = read();
    var panel = root.document.querySelector('[data-home-recovery]');
    if (!panel || !state) { if (panel) setHidden(panel, true); return null; }
    restoreForm(root.document.querySelector('form[data-home-journey="true"]'), state);
    var isHandoff = state.stage === 'handoff_recovery';
    var title = panel.querySelector('[data-home-recovery-title]');
    var copy = panel.querySelector('[data-home-recovery-copy]');
    var continueButton = panel.querySelector('[data-home-recovery-continue]');
    if (title) title.textContent = isHandoff ? 'Your request is ready to continue.' : 'Continue where you left off?';
    if (copy) copy.textContent = isHandoff
      ? 'Your contact permission and review context are already connected in this tab. Continue to CoverageFit without submitting the form again.'
      : 'Your three quick-question answers are saved in this tab. No contact or property details were stored in this checkpoint.';
    if (continueButton) continueButton.textContent = isHandoff ? 'Continue to CoverageFit' : 'Continue My Review';
    setHidden(panel, false);
    if (isHandoff) {
      ['[data-home-engagement]', '[data-home-payoff]', '[data-home-lead-intro]', 'form[data-home-journey="true"]', '[data-home-confirmation-panel]'].forEach(function (selector) { setHidden(root.document.querySelector(selector), true); });
    }
    root.HomeJourneyBaseline?.emit?.(
      isHandoff ? root.HomeJourneyContract?.EVENTS?.HANDOFF_RECOVERY_VIEWED : root.HomeJourneyContract?.EVENTS?.JOURNEY_RESUMED,
      {
        stage: state.stage,
        resume_stage: state.stage,
        branch: state.branch,
        recovery_type: isHandoff ? 'saved_handoff_available' : 'bounded_checkpoint_available'
      },
      { onceKey: isHandoff ? 'handoff_recovery_viewed' : 'journey_resume_available' }
    );
    return state;
  }

  function startOver() {
    var prior = read();
    clear();
    root.HomeJourneyBaseline?.emit?.(root.HomeJourneyContract?.EVENTS?.JOURNEY_RESTARTED, {
      stage: prior?.stage || 'engagement',
      resume_stage: prior?.stage || '',
      branch: prior?.branch || '',
      recovery_type: 'visitor_selected_start_over'
    });
    try { root.document?.dispatchEvent(new root.CustomEvent('408farmers:home-journey-restarted', { detail: { build: BUILD } })); } catch (_) {}
    var path = root.location?.pathname || '/home/';
    var search = root.location?.search || '';
    try { root.location.replace(path + search); } catch (_) { if (root.location) root.location.href = path + search; }
  }

  function bind() {
    if (!root.document?.querySelector) return;
    var panel = root.document.querySelector('[data-home-recovery]');
    if (!panel || panel.dataset.homeRecoveryBound === 'true') return;
    panel.dataset.homeRecoveryBound = 'true';
    panel.querySelector('[data-home-recovery-continue]')?.addEventListener('click', function () {
      var state = read();
      setHidden(panel, true);
      var name = state?.stage === 'handoff_recovery' ? '408farmers:home-handoff-retry' : '408farmers:home-resume-requested';
      try { root.document.dispatchEvent(new root.CustomEvent(name, { detail: state })); } catch (_) {}
    });
    panel.querySelector('[data-home-recovery-start-over]')?.addEventListener('click', startOver);
    root.setTimeout(renderRecovery, 0);
    root.addEventListener?.('pageshow', function () { root.setTimeout(renderRecovery, 0); });
  }

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', bind, { once: true });
    else bind();
  }

  return Object.freeze({ VERSION: VERSION, BUILD: BUILD, STORAGE_KEY: STORAGE_KEY, TTL_MS: TTL_MS, STAGES: STAGES.slice(), SEMANTIC: SEMANTIC, BRANCHES: BRANCHES, normalize: normalize, read: read, write: write, clear: clear, resolveBranch: resolveBranch, fromForm: fromForm, saveFromForm: saveFromForm, restoreForm: restoreForm, markHandoff: markHandoff, renderRecovery: renderRecovery });
});
