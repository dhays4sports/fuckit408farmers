/* 408-LIFE-1.8 — split-vault life application-start transport. No browser persistence or analytics. */
(function (window, document) {
  'use strict';

  var BUILD = '408-LIFE-1.8';
  var ENDPOINT = '/api/life/application-init';
  var startedAt = Date.now();
  var submissionId = createSubmissionId();
  var inFlight = false;

  function createSubmissionId() {
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

  function text(form, name) {
    var input = form.elements[name];
    return input ? String(input.value || '').trim() : '';
  }

  function selected(form, name) {
    var node = form.querySelector('input[name="' + name + '"]:checked');
    return node ? node.value : '';
  }

  function selectedMany(form, name) {
    return Array.prototype.slice.call(form.querySelectorAll('input[name="' + name + '"]:checked')).map(function (input) { return input.value; });
  }

  function validDob(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var date = new Date(value + 'T12:00:00Z');
    if (Number.isNaN(date.getTime())) return false;
    var now = new Date();
    var oldest = new Date(now.getUTCFullYear() - 120, now.getUTCMonth(), now.getUTCDate());
    return date < now && date >= oldest;
  }

  function collect(form, mode) {
    var protection = selectedMany(form, 'protection_priority');
    var phone = text(form, 'phone');
    var campaign = window.LifeCampaignAttribution && typeof window.LifeCampaignAttribution.snapshot === 'function'
      ? window.LifeCampaignAttribution.snapshot()
      : { channel:'life_campaign', landing_variant:'before_anything_changes', creative_code:'A', utm_source:'direct', utm_medium:'direct', utm_campaign:'life_insurability', utm_content:'before_anything_changes', utm_term:'', campaign_id:'', campaign_variant:'A' };
    var payload = {
      schema_version: '408-life-application-init-v2',
      submission_mode: mode,
      submission_id: submissionId,
      attribution: campaign,
      engagement: {
        protection_priority: protection,
        income_runway: selected(form, 'income_runway'),
        existing_life_coverage: selected(form, 'existing_life_coverage')
      },
      applicant: {
        first_name: text(form, 'first_name'),
        middle_name: text(form, 'middle_name'),
        last_name: text(form, 'last_name'),
        gender: selected(form, 'gender'),
        residential_address: text(form, 'residential_address'),
        residential_address_2: text(form, 'residential_address_2'),
        residential_city: text(form, 'residential_city'),
        residential_state: text(form, 'residential_state'),
        residential_zip: text(form, 'residential_zip'),
        email: text(form, 'email'),
        phone: phone
      },
      sensitive: {
        date_of_birth: mode === 'carrier_application_start' ? text(form, 'date_of_birth') : '',
        ssn_last4: mode === 'carrier_application_start' ? text(form, 'ssn_last4') : ''
      },
      acknowledgement: {
        application_preparation: mode === 'carrier_application_start' && selected(form, 'application_acknowledgement') === 'acknowledged',
        sensitive_use_notice: mode === 'carrier_application_start' && selected(form, 'application_acknowledgement') === 'acknowledged'
      },
      anti_bot: {
        website: text(form, 'website'),
        elapsed_ms: Math.max(0, Date.now() - startedAt)
      }
    };
    return payload;
  }

  function clientValid(payload, mode) {
    if (!payload || !payload.submission_id) return false;
    if (!Array.isArray(payload.engagement.protection_priority) || !payload.engagement.protection_priority.length) return false;
    if (!payload.engagement.income_runway || !payload.engagement.existing_life_coverage) return false;
    var a = payload.applicant;
    if (!a.first_name || !a.last_name || !a.gender) return false;
    if (!a.residential_address || !a.residential_city || !a.residential_state || !/^\d{5}(?:-\d{4})?$/.test(a.residential_zip)) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) return false;
    if (a.phone && a.phone.replace(/\D/g, '').length < 10) return false;
    if (mode === 'finish_with_dylan_later') {
      return payload.sensitive.date_of_birth === '' && payload.sensitive.ssn_last4 === '' &&
        payload.acknowledgement.application_preparation === false && payload.acknowledgement.sensitive_use_notice === false;
    }
    if (mode !== 'carrier_application_start') return false;
    if (!validDob(payload.sensitive.date_of_birth) || !/^\d{4}$/.test(payload.sensitive.ssn_last4)) return false;
    return payload.acknowledgement.application_preparation === true && payload.acknowledgement.sensitive_use_notice === true;
  }

  function statusNode(form) { return form.querySelector('[data-life-submit-status]'); }
  function submitButtons(form) { return Array.prototype.slice.call(form.querySelectorAll('[data-life-secure-submit],[data-life-finish-later]')); }

  function setStatus(form, message, kind) {
    var node = statusNode(form);
    if (!node) return;
    node.hidden = !message;
    node.textContent = message || '';
    node.setAttribute('data-state', kind || '');
  }

  function setBusy(form, busy) {
    form.setAttribute('aria-busy', busy ? 'true' : 'false');
    submitButtons(form).forEach(function (button) {
      if (busy) button.dataset.lifeWasDisabled = button.disabled ? 'true' : 'false';
      button.disabled = busy ? true : button.dataset.lifeWasDisabled === 'true';
      button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
      if (!busy) delete button.dataset.lifeWasDisabled;
      if (button.hasAttribute('data-life-secure-submit')) {
        button.innerHTML = busy ? 'Sending securely…' : 'Create my secure application <span aria-hidden="true">→</span>';
      }
    });
  }

  function clearSensitiveReferences(payload) {
    if (!payload) return;
    if (payload.applicant) {
      Object.keys(payload.applicant).forEach(function (key) { payload.applicant[key] = ''; });
    }
    if (payload.sensitive) {
      Object.keys(payload.sensitive).forEach(function (key) { payload.sensitive[key] = ''; });
    }
    payload.acknowledgement = null;
    payload.attribution = null;
    payload.engagement = null;
    payload.anti_bot = null;
  }

  async function submit(form, mode) {
    if (inFlight) return;
    var payload = collect(form, mode);
    if (!clientValid(payload, mode)) {
      clearSensitiveReferences(payload);
      setStatus(form, mode === 'finish_with_dylan_later'
        ? 'Please complete the required contact and residence fields so Dylan can follow up.'
        : 'Please review the carrier-required fields before creating your secure application.', 'error');
      return;
    }

    inFlight = true;
    setBusy(form, true);
    setStatus(form, mode === 'finish_with_dylan_later' ? 'Sending your follow-up request…' : 'Sending your application-start details securely…', 'pending');

    var callbackContext = mode === 'finish_with_dylan_later' ? {
      firstName: payload.applicant.first_name,
      phone: payload.applicant.phone,
      correlationId: payload.submission_id,
      productType: 'life',
      sourceRoute: '/life/'
    } : null;

    var body = JSON.stringify(payload);
    clearSensitiveReferences(payload);

    try {
      var response = await window.fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Life-Request-Version': '2'
        },
        body: body,
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        referrerPolicy: 'same-origin'
      });
      body = '';
      var result = null;
      try { result = await response.json(); } catch (ignore) { result = null; }
      if (!response.ok || !result || result.ok !== true) throw new Error('submission_failed');

      form.querySelectorAll('[data-life-phase="application"] input').forEach(function (input) {
        if (input.type === 'checkbox' || input.type === 'radio') input.checked = false;
        else input.value = '';
      });
      setStatus(form, '', '');
      document.dispatchEvent(new window.CustomEvent('life:secure-submission-complete', {
        detail: { build: BUILD, mode: mode, sensitive_status: result.sensitive_status || 'none', callbackContext: callbackContext }
      }));
      if (mode === 'carrier_application_start') window.setTimeout(function () { window.location.assign('./thank-you.html'); }, 350);
    } catch (error) {
      body = '';
      inFlight = false;
      setBusy(form, false);
      setStatus(form, 'We could not complete the secure handoff. Your information has not been confirmed as received. Please try again or contact Dylan directly.', 'error');
    }
  }

  function init() {
    if (!document.body || !document.body.classList.contains('life-page')) return;
    var form = document.querySelector('[data-life-intake-form]');
    if (!form || typeof window.fetch !== 'function') return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submit(form, 'carrier_application_start');
    });
    document.addEventListener('life:finish-later-requested', function () {
      submit(form, 'finish_with_dylan_later');
    });
    document.body.dataset.lifeSecureSubmissionReady = 'true';
  }

  window.LifeSecureSubmission = { build: BUILD, endpoint: ENDPOINT };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window, document);
