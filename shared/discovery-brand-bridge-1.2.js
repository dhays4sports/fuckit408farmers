(function (window, document) {
  'use strict';

  var COPY = Object.freeze({
    build: '408-DISCOVERY-1.2',
    relationship: 'Your review continues in CoverageFit',
    explanation: 'CoverageFit is the guided review experience Dylan uses to organize your answers and build your personalized Snapshot. Save only your first name and mobile number, or continue without saving.',
    primaryAction: 'Continue to my Snapshot in CoverageFit',
    checkpointHelper: 'Save the minimum Dylan needs to recover your review if you leave later. CoverageFit will bring your earlier answers with you.'
  });

  function setText(selector, value) {
    var node = document.querySelector(selector);
    if (node && node.textContent !== value) node.textContent = value;
  }

  function apply() {
    setText('.home-payoff-next > strong', COPY.relationship);
    setText('[data-home-payoff-next-copy]', COPY.explanation);
    setText('[data-home-payoff-continue] > span:first-child', COPY.primaryAction);
    setText('.home-lead-step-helper', COPY.checkpointHelper);
    setText('[data-home-lead-submit-label]', COPY.primaryAction);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();

  window.DiscoveryBrandBridge = Object.freeze({ build: COPY.build, copy: COPY, apply: apply });
})(window, document);
