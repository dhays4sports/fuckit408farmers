(function (window, document) {
  'use strict';

  var form = document.querySelector('form[data-home-confirmation="true"]');
  var panel = document.querySelector('[data-home-confirmation-panel]');
  if (!form || !panel) return;

  var leadIntro = document.querySelector('[data-home-lead-intro]');
  var payoff = document.querySelector('[data-home-payoff]');
  var kicker = panel.querySelector('[data-home-confirmation-kicker]');
  var status = panel.querySelector('[data-home-confirmation-status]');
  var nextTitle = panel.querySelector('[data-home-confirmation-next-title]');
  var nextCopy = panel.querySelector('[data-home-confirmation-next-copy]');
  var live = panel.querySelector('[data-home-confirmation-live]');
  var button = panel.querySelector('[data-home-confirmation-continue]');
  var timer = null;
  var continueCallback = null;
  var continued = false;

  var STATUS_COPY = Object.freeze({
    confirmed: Object.freeze({
      kicker: 'Request received',
      message: 'Dylan’s intake received your request. Your review focus and property details are ready for the next step.'
    }),
    pending: Object.freeze({
      kicker: 'Review ready',
      message: 'Your request is still being delivered in the background. You can keep going now.'
    }),
    unconfirmed: Object.freeze({
      kicker: 'Review ready',
      message: 'Delivery could not be confirmed yet. Your saved review can still continue, and Dylan’s contact options remain available.'
    }),
    'local-fallback': Object.freeze({
      kicker: 'Review ready',
      message: 'Your details are saved in this browser so the review can continue. Dylan’s contact options remain available.'
    })
  });

  function emit(name, extra) {
    var baseline = window.HomeJourneyBaseline;
    if (!baseline || typeof baseline.emit !== 'function') return;
    baseline.emit(name, extra || {});
  }

  function finish(trigger) {
    if (continued || typeof continueCallback !== 'function') return;
    continued = true;
    if (timer) window.clearTimeout(timer);
    timer = null;
    button.disabled = true;
    live.textContent = 'Continuing now…';
    emit(window.HomeJourneyContract.EVENTS.CONFIRMATION_CONTINUED, {
      stage: window.HomeJourneyContract.STAGES.CONFIRMATION,
      continuation_trigger: trigger,
      destination_type: panel.dataset.destinationType || 'coveragefit',
      lead_capture_status: panel.dataset.leadCaptureStatus || ''
    });
    continueCallback();
  }

  function show(options) {
    var settings = options || {};
    if (typeof settings.onContinue !== 'function') return false;

    var leadStatus = Object.prototype.hasOwnProperty.call(STATUS_COPY, settings.leadCaptureStatus)
      ? settings.leadCaptureStatus
      : 'unconfirmed';
    var destinationType = settings.destinationType === 'renters' ? 'renters' : 'coveragefit';
    var copy = STATUS_COPY[leadStatus];
    var delay = Number.parseInt(form.dataset.homeConfirmationDelay || '1250', 10);
    if (!Number.isFinite(delay)) delay = 1250;
    delay = Math.max(500, Math.min(delay, 5000));

    continued = false;
    continueCallback = settings.onContinue;
    panel.dataset.leadCaptureStatus = leadStatus;
    panel.dataset.destinationType = destinationType;
    kicker.textContent = copy.kicker;
    status.textContent = copy.message;
    button.disabled = false;

    if (destinationType === 'renters') {
      nextTitle.textContent = 'Next: renters contact options';
      nextCopy.textContent = 'We’ll open Dylan’s renters contact options instead of sending you into the homeowner assessment.';
      live.textContent = 'Opening renters contact options automatically…';
      button.querySelector('span:first-child').textContent = 'Continue to renters options';
    } else {
      nextTitle.textContent = 'Next: confirm your property';
      nextCopy.textContent = 'CoverageFit will ask you to confirm the property once, then begin the assessment without re-entering your details.';
      live.textContent = 'Opening CoverageFit automatically…';
      button.querySelector('span:first-child').textContent = 'Continue now';
    }

    form.hidden = true;
    form.setAttribute('aria-hidden', 'true');
    if (leadIntro) leadIntro.hidden = true;
    if (payoff) payoff.hidden = true;
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    panel.style.setProperty('--home-confirmation-delay', delay + 'ms');

    emit(window.HomeJourneyContract.EVENTS.CONFIRMATION_VIEWED, {
      stage: window.HomeJourneyContract.STAGES.CONFIRMATION,
      destination_type: destinationType,
      lead_capture_status: leadStatus
    });

    try { panel.focus({ preventScroll: true }); } catch (_) { panel.focus(); }
    try {
      panel.scrollIntoView({
        behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center'
      });
    } catch (_) {}

    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(function () { finish('automatic'); }, delay);
    return true;
  }

  button.addEventListener('click', function () { finish('manual'); });
  window.addEventListener('pagehide', function () {
    if (timer) window.clearTimeout(timer);
    timer = null;
  });

  window.HomeLeadConfirmation = Object.freeze({ show: show });
})(window, document);
