(function (window, document) {
  'use strict';

  var BUILD = '408-FLOW-2.2';
  var form = document.querySelector('form[data-home-journey="true"][data-form-first="true"]');
  var engagement = document.querySelector('[data-home-engagement]');
  var payoff = document.querySelector('[data-home-payoff]');
  var leadIntro = document.querySelector('[data-home-lead-intro]');
  var section = document.querySelector('[data-home-journey-stage]');
  var recovery = document.querySelector('[data-home-recovery]');
  var continuity = window.HomeJourneyContinuity;
  var contract = window.HomeJourneyContract;
  if (!form || !contract) return;

  function hide(node, value) {
    if (!node) return;
    node.hidden = Boolean(value);
    node.setAttribute('aria-hidden', value ? 'true' : 'false');
  }

  var saved = continuity && typeof continuity.read === 'function' ? continuity.read() : null;
  var handoffRecovery = saved && saved.stage === 'handoff_recovery';

  hide(engagement, true);
  hide(payoff, true);
  form.dataset.engagementComplete = 'deferred_until_after_lead';

  if (saved && !handoffRecovery && continuity && typeof continuity.clear === 'function') {
    continuity.clear();
  }

  if (handoffRecovery) {
    hide(leadIntro, true);
    hide(form, true);
    return;
  }

  hide(recovery, true);
  hide(leadIntro, false);
  hide(form, false);
  if (section) section.dataset.homeJourneyStage = contract.STAGES.LEAD_CAPTURE;

  try {
    document.dispatchEvent(new window.CustomEvent('408farmers:home-lead-revealed', {
      detail: { housing_context: '', form_first: true, build: BUILD }
    }));
  } catch (_) {}

  window.HomeFormFirst = Object.freeze({ BUILD: BUILD, active: true });
})(window, document);
