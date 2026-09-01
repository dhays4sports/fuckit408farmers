(function (window, document) {
  'use strict';

  var contract = window.HomeJourneyContract;
  if (!contract) return;

  var emitted = Object.create(null);
  var allowedEvents = Object.keys(contract.EVENTS).map(function (key) { return contract.EVENTS[key]; });
  var allowedExtra = [
    'stage', 'status', 'lead_capture_status', 'assessment', 'entry', 'launch_surface',
    'source', 'campaign', 'campaign_id', 'campaign_variant', 'campaign_zip',
    'review_context_set', 'semantic_context_set',
    'step', 'step_count', 'semantic_field', 'semantic_value',
    'home_review_goal', 'housing_context', 'review_timing',
    'continuation_trigger', 'destination_type',
    'campaign_entry', 'message_variant', 'route_type',
    'resume_stage', 'branch', 'property_required', 'recovery_type'
  ];

  function clean(value, max) {
    return String(value === undefined || value === null ? '' : value)
      .trim()
      .replace(/[<>\u0000-\u001F\u007F]/g, '')
      .slice(0, max || 160);
  }

  function attribution() {
    var value = window.CoverageFitLauncher && typeof window.CoverageFitLauncher.getAttribution === 'function'
      ? window.CoverageFitLauncher.getAttribution() || {}
      : {};
    return {
      source: clean(value.source || '408farmers', 80),
      campaign: clean(value.campaign, 160),
      campaign_id: clean(value.campaign_id, 180),
      campaign_variant: clean(value.campaign_variant, 30),
      campaign_zip: /^\d{5}$/.test(clean(value.campaign_zip, 10)) ? clean(value.campaign_zip, 10) : ''
    };
  }

  function formContext() {
    var form = document.querySelector('form[data-home-journey="true"]');
    var semantic = contract.fromForm(form);
    var reviewContext = form && form.elements && form.elements.review_context
      ? clean(form.elements.review_context.value, 120)
      : '';
    return {
      entry: clean(form && form.dataset.cfEntry || 'home_lander_form', 100),
      launch_surface: clean(form && form.dataset.cfExtraLaunchSurface || 'home_lander', 100),
      assessment: clean(form && form.dataset.cfAssessment || 'home', 40),
      review_context_set: Boolean(reviewContext),
      semantic_context_set: contract.hasSemanticContext(semantic)
    };
  }

  function emit(eventName, extra, options) {
    if (allowedEvents.indexOf(eventName) === -1) return null;
    var opts = options || {};
    var onceKey = opts.onceKey || '';
    if (onceKey && emitted[onceKey]) return null;
    if (onceKey) emitted[onceKey] = true;

    var detail = Object.assign({
      event: eventName,
      build: contract.BUILD,
      journey_contract: contract.CONTRACT,
      route: '/home/'
    }, attribution(), formContext());

    var source = extra && typeof extra === 'object' ? extra : {};
    allowedExtra.forEach(function (key) {
      if (source[key] === undefined || source[key] === null || source[key] === '') return;
      detail[key] = typeof source[key] === 'boolean' ? source[key] : clean(source[key], 180);
    });

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(detail);
    try {
      document.dispatchEvent(new window.CustomEvent('408farmers:home-journey-event', { detail: detail }));
    } catch (_) {}
    return detail;
  }

  function init() {
    var form = document.querySelector('form[data-home-journey="true"]');
    if (!form || !document.body || !document.body.classList.contains('home-page')) return;

    emit(contract.EVENTS.JOURNEY_VIEWED, { stage: contract.STAGES.LANDING }, { onceKey: 'journey_viewed' });

    var campaign = window.Farmers408FlyerCampaign && typeof window.Farmers408FlyerCampaign.getCurrent === 'function'
      ? window.Farmers408FlyerCampaign.getCurrent()
      : null;
    if (campaign && campaign.active) {
      emit(contract.EVENTS.CAMPAIGN_MATCHED, {
        stage: contract.STAGES.LANDING,
        campaign_entry: campaign.entryMethod,
        message_variant: campaign.campaignVariant,
        route_type: campaign.qr ? 'qr' : 'campaign'
      }, { onceKey: 'campaign_matched' });
      if (campaign.qr) {
        emit(contract.EVENTS.QR_ROUTE_RESOLVED, {
          stage: contract.STAGES.LANDING,
          campaign_entry: campaign.entryMethod,
          message_variant: campaign.campaignVariant,
          route_type: 'qr'
        }, { onceKey: 'qr_route_resolved' });
      }
    }

    document.querySelectorAll('.home-primary-cta').forEach(function (link) {
      link.addEventListener('click', function () {
        emit(contract.EVENTS.PRIMARY_CTA_SELECTED, { stage: contract.STAGES.LANDING }, { onceKey: 'primary_cta' });
      });
    });

    function startForm(event) {
      var target = event && event.target;
      if (target && (target.type === 'hidden' || target.type === 'submit' || target.type === 'button')) return;
      emit(contract.EVENTS.LEAD_FORM_STARTED, { stage: contract.STAGES.LEAD_CAPTURE }, { onceKey: 'form_started' });
    }

    form.addEventListener('focusin', startForm);
    form.addEventListener('input', startForm);
    form.addEventListener('change', startForm);
  }

  window.HomeJourneyBaseline = Object.freeze({
    version: contract.VERSION,
    build: contract.BUILD,
    emit: emit
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window, document);
