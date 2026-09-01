(function (window, document) {
  'use strict';

  var BUILD = '408-CF-RPT-1.1';
  var form = document.querySelector('form[data-coveragefit-invitation="true"]');
  if (!form) return;

  var panel = document.createElement('section');
  panel.className = 'coveragefit-invitation';
  panel.dataset.coveragefitInvitationPanel = '';
  panel.hidden = true;
  panel.tabIndex = -1;
  panel.setAttribute('aria-labelledby', 'coveragefit-invitation-title');
  panel.innerHTML = [
    '<div class="coveragefit-invitation-status">',
      '<img class="coveragefit-human-portrait" src="/shared/images/dylan-headshot-160.webp" width="52" height="52" alt="Dylan Haysbert" decoding="async">',
      '<div><strong>Your request is complete.</strong>',
      '<p>Your information is already submitted, and I have what I need to start reviewing it. The next step is entirely your choice.</p></div>',
    '</div>',
    '<div class="coveragefit-invitation-live sr-only" data-coveragefit-invitation-live role="status" aria-live="polite" aria-atomic="true"></div>',
    '<div data-coveragefit-invitation-choice>',
      '<div class="coveragefit-invitation-kicker">Optional next step</div>',
      '<h2 id="coveragefit-invitation-title">Would you like to get a head start on Dylan’s review?</h2>',
      '<p class="coveragefit-invitation-intro">If you want, CoverageFit can organize a little more context before I review your options. Your original request stays submitted either way.</p>',
      '<div class="coveragefit-invitation-options" role="group" aria-label="Choose what happens next">',
        '<article class="coveragefit-invitation-option coveragefit-invitation-option--score" data-coveragefit-score-option>',
          '<span class="coveragefit-invitation-tag">About five minutes</span>',
          '<h3 data-coveragefit-score-title>Build my Protection Score</h3>',
          '<p data-coveragefit-score-copy>Complete the educational CoverageFit assessment to receive your Protection Score and a free Home Protection Snapshot you can save as a PDF or print.</p>',
          '<ul data-coveragefit-score-benefits>',
            '<li>See what you already understand about your protection</li>',
            '<li>Identify details worth verifying with Dylan</li>',
            '<li>Save the finished Snapshot as a PDF or print it</li>',
          '</ul>',
          '<button class="primary-button" type="button" data-coveragefit-invitation-continue><span>Continue to CoverageFit</span><span aria-hidden="true">→</span></button>',
        '</article>',
        '<article class="coveragefit-invitation-option coveragefit-invitation-option--followup">',
          '<span class="coveragefit-invitation-tag">Stop here</span>',
          '<h3>Have me follow up</h3>',
          '<p>No additional questions right now. I can contact you using the preference and details you already provided.</p>',
          '<button class="coveragefit-invitation-finish" type="button" data-coveragefit-invitation-finish>Finish for Now</button>',
        '</article>',
      '</div>',
      '<button class="coveragefit-invitation-back" type="button" data-coveragefit-invitation-back hidden>Back to my answers</button>',
      '<p class="coveragefit-invitation-disclosure">CoverageFit is educational. It is not a quote, coverage determination, eligibility decision, or promise of savings.</p>',
    '</div>',
    '<div class="coveragefit-invitation-finished" data-coveragefit-invitation-finished hidden>',
      '<div class="coveragefit-invitation-kicker">You’re all set</div>',
      '<h2>I have your request.</h2>',
      '<p>There is nothing else you need to complete right now. I can follow up using the contact preference you provided.</p>',
      '<div class="coveragefit-invitation-contact">',
        '<a href="sms:+14083276377">Text Dylan</a>',
        '<a href="tel:+14083276377">Call Dylan</a>',
      '</div>',
    '</div>'
  ].join('');

  var anchor = document.querySelector('[data-post-lead-engagement-panel]') || form;
  anchor.insertAdjacentElement('afterend', panel);

  var choice = panel.querySelector('[data-coveragefit-invitation-choice]');
  var finished = panel.querySelector('[data-coveragefit-invitation-finished]');
  var continueButton = panel.querySelector('[data-coveragefit-invitation-continue]');
  var finishButton = panel.querySelector('[data-coveragefit-invitation-finish]');
  var backButton = panel.querySelector('[data-coveragefit-invitation-back]');
  var live = panel.querySelector('[data-coveragefit-invitation-live]');
  var state = { active: false, continued: false, onContinue: null, onBack: null, leadCaptureStatus: 'unconfirmed', destinationType: 'coveragefit' };

  function focusPanel() {
    try { panel.focus({ preventScroll: true }); } catch (_) { panel.focus(); }
    try {
      panel.scrollIntoView({
        behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center'
      });
    } catch (_) {}
  }

  function emit(name, extra) {
    var detail = Object.assign({
      build: BUILD,
      entry: form.dataset.cfEntry || 'lead_form',
      lead_capture_status: state.leadCaptureStatus,
      destination_type: state.destinationType
    }, extra || {});
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: name }, detail));
    if (typeof window.CustomEvent === 'function') {
      document.dispatchEvent(new window.CustomEvent('408farmers:' + name, { detail: detail }));
    }
  }

  function present(options) {
    var settings = options || {};
    if (state.active || typeof settings.onContinue !== 'function') return false;
    state.active = true;
    state.continued = false;
    state.onContinue = settings.onContinue;
    state.onBack = typeof settings.onBack === 'function' ? settings.onBack : null;
    state.leadCaptureStatus = String(settings.leadCaptureStatus || 'unconfirmed');
    state.destinationType = settings.destinationType === 'renters' ? 'renters' : 'coveragefit';

    var priorPanel = document.querySelector('[data-post-lead-engagement-panel]');
    if (priorPanel) priorPanel.hidden = true;
    form.hidden = true;
    form.setAttribute('aria-hidden', 'true');
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    choice.hidden = false;
    finished.hidden = true;
    continueButton.disabled = false;
    backButton.hidden = !state.onBack;

    var scoreTitle = panel.querySelector('[data-coveragefit-score-title]');
    var scoreCopy = panel.querySelector('[data-coveragefit-score-copy]');
    var benefits = panel.querySelector('[data-coveragefit-score-benefits]');
    var continueLabel = continueButton.querySelector('span:first-child');
    if (state.destinationType === 'renters') {
      scoreTitle.textContent = 'Continue to renter-specific options';
      scoreCopy.textContent = 'Skip the homeowner assessment and open Dylan’s renter contact options instead.';
      benefits.hidden = true;
      continueLabel.textContent = 'View Renters Options';
    } else {
      scoreTitle.textContent = 'Build my Protection Score';
      scoreCopy.textContent = 'Complete the educational CoverageFit assessment to receive your Protection Score and a free Home Protection Snapshot you can save as a PDF or print.';
      benefits.hidden = false;
      continueLabel.textContent = 'Continue to CoverageFit';
    }

    live.textContent = state.destinationType === 'renters'
      ? 'Choose whether to view renter-specific options or finish for now.'
      : 'Choose whether to continue to CoverageFit or finish for now.';
    emit('coveragefit_invitation_viewed', { invitation_optional: true });
    focusPanel();
    return true;
  }

  continueButton.addEventListener('click', function () {
    if (state.continued || typeof state.onContinue !== 'function') return;
    state.continued = true;
    continueButton.disabled = true;
    continueButton.querySelector('span:first-child').textContent = state.destinationType === 'renters'
      ? 'Opening Renters Options…'
      : 'Opening CoverageFit…';
    live.textContent = state.destinationType === 'renters'
      ? 'Opening renter-specific options now.'
      : 'Opening CoverageFit now.';
    emit('coveragefit_invitation_accepted', { invitation_optional: true });
    state.onContinue();
  });

  finishButton.addEventListener('click', function () {
    choice.hidden = true;
    finished.hidden = false;
    live.textContent = 'Your request is complete. I can follow up.';
    emit('coveragefit_invitation_deferred', { invitation_optional: true });
    focusPanel();
  });

  backButton.addEventListener('click', function () {
    if (!state.onBack) return;
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    state.active = false;
    emit('coveragefit_invitation_back_selected', { invitation_optional: true });
    state.onBack();
  });

  window.CoverageFitInvitation = Object.freeze({ BUILD: BUILD, present: present });
})(window, document);
