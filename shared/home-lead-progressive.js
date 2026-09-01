(function (window, document) {
  'use strict';

  var form = document.querySelector('form[data-home-progressive-lead="true"]');
  var contract = window.HomeJourneyContract;
  var baseline = window.HomeJourneyBaseline;
  var continuity = window.HomeJourneyContinuity;
  if (!form || !contract) return;

  var step = form.querySelector('[data-home-lead-step="1"]');
  var progress = form.querySelector('[data-home-lead-progress]');
  var progressLabel = form.querySelector('[data-home-lead-progress-label]');
  var progressBar = form.querySelector('[data-home-lead-progress-bar]');
  var skip = form.querySelector('[data-continue-without-saving]');
  var live = document.querySelector('[data-home-engagement-live]');
  var active = false;

  function emit(name, extra, onceKey) {
    if (!baseline || typeof baseline.emit !== 'function') return;
    baseline.emit(name, extra || {}, onceKey ? { onceKey: onceKey } : {});
  }

  function announce(message) {
    if (!live) return;
    live.textContent = '';
    window.setTimeout(function () { live.textContent = message; }, 20);
  }

  function checkpointId() {
    var builder = window.ProspectProfileBuilder;
    var id = builder && typeof builder.leadCheckpointId === 'function'
      ? builder.leadCheckpointId()
      : '';
    if (form.elements.lead_checkpoint_id) form.elements.lead_checkpoint_id.value = id;
    return id;
  }

  function validMinimumIdentity() {
    var firstName = form.elements.first_name;
    var phone = form.elements.phone;
    var consent = form.elements.consent;
    var digits = String(phone && phone.value || '').replace(/\D/g, '');
    if (phone) phone.setCustomValidity(digits.length >= 10 ? '' : 'Please enter a valid mobile number.');
    var fields = [firstName, phone, consent].filter(Boolean);
    for (var index = 0; index < fields.length; index += 1) {
      if (!fields[index].checkValidity()) {
        fields[index].reportValidity();
        fields[index].focus();
        return false;
      }
    }
    return true;
  }

  function activate(event) {
    if (active) return;
    active = true;
    var detail = event && event.detail ? event.detail : {};
    form.classList.add('home-lead-progressive-active');
    if (progress) progress.hidden = false;
    if (progressLabel) progressLabel.textContent = 'Optional save checkpoint';
    if (progressBar) {
      progressBar.style.width = '100%';
      var track = progressBar.parentElement;
      if (track) {
        track.setAttribute('aria-valuenow', '1');
        track.setAttribute('aria-valuetext', 'Optional save checkpoint');
      }
    }
    if (step) step.hidden = false;
    checkpointId();
    continuity?.saveFromForm?.(form, {
      stage: contract.STAGES.LEAD_CAPTURE,
      leadStep: 1,
      engagementStep: 3
    });
    emit(contract.EVENTS.LEAD_CAPTURE_PRESENTED, {
      stage: contract.STAGES.LEAD_CAPTURE,
      step: 1,
      step_count: 1,
      housing_context: String(detail.housing_context || form.elements.housing_context?.value || ''),
      optional_checkpoint: true
    }, 'lead_capture_presented');
    emit(contract.EVENTS.LEAD_CAPTURE_STEP_VIEWED, {
      stage: contract.STAGES.LEAD_CAPTURE,
      step: 1,
      step_count: 1
    });
    announce('Optional save checkpoint. Enter your first name and mobile number, or continue without saving.');
  }

  form.addEventListener('submit', function () {
    if (!active) return;
    checkpointId();
    if (form.elements.contact_consent_timestamp) {
      form.elements.contact_consent_timestamp.value = new Date().toISOString();
    }
    if (!validMinimumIdentity()) return;
    emit(contract.EVENTS.LEAD_CAPTURE_STEP_COMPLETED, {
      stage: contract.STAGES.LEAD_CAPTURE,
      step: 1,
      step_count: 1
    }, 'lead_capture_step_1_completed');
  });

  if (skip) skip.addEventListener('click', function () {
    emit('home_early_capture_skipped', {
      stage: contract.STAGES.LEAD_CAPTURE,
      housing_context: String(form.elements.housing_context?.value || ''),
      lead_capture_status: 'skipped'
    }, 'early_capture_skipped');
    try {
      document.dispatchEvent(new window.CustomEvent('408farmers:continue-without-saving', {
        detail: {
          housing_context: String(form.elements.housing_context?.value || ''),
          lead_checkpoint_id: checkpointId()
        }
      }));
    } catch (_) {}
  });

  document.addEventListener('408farmers:home-lead-revealed', activate);

  window.HomeLeadProgressive = Object.freeze({
    build: '408-DISCOVERY-1.0',
    isActive: function () { return active; },
    currentStep: function () { return 1; },
    validMinimumIdentity: validMinimumIdentity
  });
})(window, document);
