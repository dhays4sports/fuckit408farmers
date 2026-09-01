(function (window, document) {
  'use strict';

  var COPY = Object.freeze({
    build: '408-DISCOVERY-1.3',
    payoffTitle: 'Keep building your Snapshot.',
    bridge: 'Next: CoverageFit. Your answers are already connected.',
    primaryAction: 'Continue to my Snapshot',
    checkpointTitle: 'Keep your review connected.',
    checkpointHelper: 'Save your first name and mobile so Dylan can recover your review if you leave.',
    anonymousAction: 'Continue without saving'
  });

  function setText(selector, value) {
    var node = document.querySelector(selector);
    if (node && node.textContent !== value) node.textContent = value;
  }

  function apply() {
    setText('.home-payoff-next > strong', COPY.payoffTitle);
    setText('[data-home-payoff-next-copy]', COPY.bridge);
    setText('[data-home-payoff-continue] > span:first-child', COPY.primaryAction);
    setText('[data-home-lead-step="1"] > legend', COPY.checkpointTitle);
    setText('.home-lead-step-helper', COPY.checkpointHelper);
    setText('[data-home-lead-submit-label]', COPY.primaryAction);
    setText('[data-continue-without-saving]', COPY.anonymousAction);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();

  window.DiscoveryBrandBridge = Object.freeze({ build: COPY.build, copy: COPY, apply: apply });
})(window, document);
