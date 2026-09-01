/* 408-LIFE-1.7 — first-party conversion measurement. Campaign-only metadata; no applicant data or browser persistence. */
(function (window, document) {
  'use strict';

  var BUILD = '408-LIFE-1.7';
  var ENDPOINT = '/api/life/conversion';
  var SCHEMA = '408-life-conversion-v1';
  var journeyId = createId();
  var sent = Object.create(null);

  function createId() {
    var cryptoApi = window.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
      var bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      var hex = Array.prototype.map.call(bytes, function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
      return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
    }
    return '';
  }

  function attribution() {
    if (window.LifeCampaignAttribution && typeof window.LifeCampaignAttribution.snapshot === 'function') {
      var source = window.LifeCampaignAttribution.snapshot();
      return {
        channel: source.channel,
        landing_variant: source.landing_variant,
        creative_code: source.creative_code,
        utm_source: source.utm_source,
        utm_medium: source.utm_medium,
        utm_campaign: source.utm_campaign,
        utm_content: source.utm_content,
        campaign_id: source.campaign_id,
        campaign_variant: source.campaign_variant
      };
    }
    return {
      channel: 'life_campaign', landing_variant: 'before_anything_changes', creative_code: 'A',
      utm_source: 'direct', utm_medium: 'direct', utm_campaign: 'life_insurability',
      utm_content: 'before_anything_changes', campaign_id: '', campaign_variant: 'A'
    };
  }

  function emit(eventName) {
    if (!journeyId || sent[eventName] || typeof window.fetch !== 'function') return;
    sent[eventName] = true;
    var payload = {
      schema_version: SCHEMA,
      event_id: createId(),
      journey_id: journeyId,
      event_name: eventName,
      attribution: attribution()
    };
    var body = JSON.stringify(payload);
    payload.attribution = null;
    window.fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Life-Conversion-Version': '1' },
      body: body,
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'same-origin',
      keepalive: true
    }).catch(function () { /* Measurement is fail-open and never blocks the applicant journey. */ });
    body = '';
  }

  function init() {
    if (!document.body || !document.body.classList.contains('life-page')) return;
    document.body.dataset.lifeConversionReady = 'true';
    emit('landing_view');

    document.querySelectorAll('[data-life-start]').forEach(function (node) {
      node.addEventListener('click', function () { emit('start_clicked'); }, { once: true });
    });

    document.addEventListener('life:intake-progress', function (event) {
      var detail = event && event.detail ? event.detail : {};
      if (detail.phase === 'engagement' && detail.completed === true) emit('quick_questions_complete');
      if (detail.phase === 'application' && detail.step === 4 && detail.completed === false) emit('application_details_started');
    });

    document.addEventListener('life:secure-submission-complete', function () {
      emit('application_start_submitted');
    });
  }

  window.LifeConversion = Object.freeze({ build: BUILD, endpoint: ENDPOINT, schema: SCHEMA });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window, document);
