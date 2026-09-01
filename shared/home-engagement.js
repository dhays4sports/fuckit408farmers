(function (window, document) {
  'use strict';

  var contract = window.HomeJourneyContract;
  var baseline = window.HomeJourneyBaseline;
  var continuity = window.HomeJourneyContinuity;
  var root = document.querySelector('[data-home-engagement]');
  var payoff = document.querySelector('[data-home-payoff]');
  var form = document.querySelector('form[data-home-journey="true"]');
  var leadIntro = document.querySelector('[data-home-lead-intro]');
  if (!contract || !root || !payoff || !form) return;

  var steps = Array.prototype.slice.call(root.querySelectorAll('[data-home-step]'));
  var current = 0;
  var completed = false;
  var continuityStarted = Boolean(continuity?.read?.());
  var fieldMap = Object.freeze({
    1: Object.freeze({ radio: 'engagement_home_review_goal', form: 'home_review_goal' }),
    2: Object.freeze({ radio: 'engagement_review_timing', form: 'review_timing' }),
    3: Object.freeze({ radio: 'engagement_housing_context', form: 'housing_context' })
  });
  var progressLabel = root.querySelector('[data-home-progress-label]');
  var progressBar = root.querySelector('[data-home-progress-bar]');
  var live = document.querySelector('[data-home-engagement-live]');
  var error = root.querySelector('[data-home-engagement-error]');
  var back = root.querySelector('[data-home-back]');
  var next = root.querySelector('[data-home-continue]');
  var payoffContinue = payoff.querySelector('[data-home-payoff-continue]');
  var payoffEdit = payoff.querySelector('[data-home-payoff-edit]');

  var PAYOFF_COPY = Object.freeze({
    goal: Object.freeze({
      farmers_fit: Object.freeze({
        title: 'Let\'s make the renewal change easier to evaluate.',
        label: 'Renewal price changed',
        copy: 'Your Snapshot will keep the price change visible alongside the protection questions that may be worth reviewing.'
      }),
      coverage_fit: Object.freeze({
        title: 'Let\'s make your coverage questions easier to answer.',
        label: 'Coverage questions',
        copy: 'Your Snapshot will organize what you want to understand without making a coverage determination.'
      }),
      home_auto_bundle: Object.freeze({
        title: 'Let\'s review your home and auto together.',
        label: 'Home + auto opportunity',
        copy: 'Your home protection comes first, while your interest in reviewing both policies stays connected.'
      }),
      exploring: Object.freeze({
        title: 'Let\'s give you a clearer place to start.',
        label: 'Low-pressure exploration',
        copy: 'Your review will organize what you have and what may be worth discussing, without pressure to make a change.'
      })
    }),
    housing: Object.freeze({
      owner_occupied: Object.freeze({ label: 'Primary residence', copy: 'The review will stay centered on the home you own and live in.' }),
      landlord: Object.freeze({ label: 'Rental property', copy: 'Dylan will keep your landlord context connected when reviewing appropriate options.' }),
      buyer: Object.freeze({ label: 'Upcoming home purchase', copy: 'Your purchase context will stay connected as you organize coverage for the home.' }),
      renter: Object.freeze({ label: 'Renters-specific review', copy: 'CoverageFit will keep the questions lightweight and build a useful renter Snapshot.' })
    }),
    timing: Object.freeze({
      shopping_now: Object.freeze({ label: 'Understand what I have', copy: 'CoverageFit will emphasize plain-language understanding of the current setup.' }),
      renewal_60: Object.freeze({ label: 'Claim support', copy: 'Service and claim-support expectations will remain part of the review context.' }),
      later: Object.freeze({ label: 'Easier access to help', copy: 'The Snapshot will keep local help and ongoing service visible.' }),
      coordination: Object.freeze({ label: 'Better coordination', copy: 'The review will keep the household policies connected in one picture.' }),
      price_only: Object.freeze({ label: 'Price only', copy: 'The comparison can stay price-focused while keeping any visible tradeoffs clear.' }),
      not_sure: Object.freeze({ label: 'Not sure yet', copy: 'The first Snapshot can still provide a useful, low-pressure starting point.' })
    })
  });

  function emit(name, extra, onceKey) {
    if (!baseline || typeof baseline.emit !== 'function') return;
    baseline.emit(name, extra, onceKey ? { onceKey: onceKey } : {});
  }

  function announce(message) {
    if (!live) return;
    live.textContent = '';
    window.setTimeout(function () { live.textContent = message; }, 20);
  }

  function motionBehavior() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }

  function selected(stepNumber) {
    var definition = fieldMap[stepNumber];
    return definition ? root.querySelector('input[name="' + definition.radio + '"]:checked') : null;
  }

  function showStep(index, options) {
    current = Math.max(0, Math.min(index, steps.length - 1));
    steps.forEach(function (step, stepIndex) { step.hidden = stepIndex !== current; });
    var stepNumber = current + 1;
    progressLabel.textContent = 'Quick questions · ' + stepNumber + ' of ' + steps.length;
    progressBar.style.width = ((stepNumber / steps.length) * 100) + '%';
    var progressTrack = progressBar.parentElement;
    if (progressTrack) {
      progressTrack.setAttribute('aria-valuenow', String(stepNumber));
      progressTrack.setAttribute('aria-valuetext', stepNumber + ' of ' + steps.length);
    }
    back.hidden = current === 0;
    next.querySelector('span').textContent = current === steps.length - 1 ? 'See my review focus' : 'Continue';
    error.hidden = true;
    steps.forEach(function (step) { step.removeAttribute('aria-invalid'); });
    if (continuityStarted) continuity?.saveFromForm?.(form, { stage: contract.STAGES.ENGAGEMENT, engagementStep: stepNumber });
    emit(contract.EVENTS.ENGAGEMENT_STEP_VIEWED, {
      stage: contract.STAGES.ENGAGEMENT,
      step: stepNumber,
      step_count: steps.length
    });
    announce('Question ' + stepNumber + ' of ' + steps.length + '. ' + steps[current].querySelector('legend').textContent);
    if (options && options.focus) {
      var checked = selected(stepNumber);
      var focusTarget = checked || steps[current].querySelector('input');
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    }
  }

  function copyAnswer(stepNumber, radio) {
    var definition = fieldMap[stepNumber];
    var destination = definition && form.elements[definition.form];
    var value = definition ? contract.allowed(definition.form, radio.value) : '';
    if (!destination || !value) return false;
    destination.value = value;
    continuityStarted = true;
    continuity?.saveFromForm?.(form, { stage: contract.STAGES.ENGAGEMENT, engagementStep: stepNumber });
    emit(contract.EVENTS.ENGAGEMENT_STEP_COMPLETED, {
      stage: contract.STAGES.ENGAGEMENT,
      step: stepNumber,
      step_count: steps.length,
      semantic_field: definition.form,
      semantic_value: value
    });
    return true;
  }

  function semanticAnswers() {
    return contract.fromForm(form);
  }

  function setText(selector, value) {
    var node = payoff.querySelector(selector);
    if (node) node.textContent = value;
  }

  function eventContext(semantic) {
    return {
      home_review_goal: semantic.homeReviewGoal,
      housing_context: semantic.housingContext,
      review_timing: semantic.reviewTiming,
      semantic_context_set: contract.hasSemanticContext(semantic)
    };
  }

  function showPayoff() {
    var semantic = semanticAnswers();
    var goal = PAYOFF_COPY.goal[semantic.homeReviewGoal];
    var housing = PAYOFF_COPY.housing[semantic.housingContext];
    var timing = PAYOFF_COPY.timing[semantic.reviewTiming];
    if (!goal || !housing || !timing) return;

    var reviewContext = contract.deriveReviewContext(semantic, form.elements.review_context.value);
    if (reviewContext) form.elements.review_context.value = reviewContext;

    setText('[data-home-payoff-title]', goal.title);
    setText('[data-home-payoff-summary]', 'Based on your answers, your next step can stay focused on what matters now—without turning this into an instant quote or coverage decision.');
    setText('[data-home-payoff-goal-title]', goal.label);
    setText('[data-home-payoff-goal-copy]', goal.copy);
    setText('[data-home-payoff-housing-title]', housing.label);
    setText('[data-home-payoff-housing-copy]', housing.copy);
    setText('[data-home-payoff-timing-title]', timing.label);
    setText('[data-home-payoff-timing-copy]', timing.copy);

    setText('[data-home-payoff-next-copy]', 'Next: CoverageFit. Your answers are already connected.');
    payoffContinue.querySelector('span').textContent = 'Continue to my Snapshot';

    root.hidden = true;
    payoff.hidden = false;
    var section = document.querySelector('[data-home-journey-stage]');
    if (section) section.dataset.homeJourneyStage = contract.STAGES.PAYOFF;
    completed = true;
    continuity?.saveFromForm?.(form, { stage: contract.STAGES.PAYOFF, engagementStep: steps.length });
    emit(contract.EVENTS.ENGAGEMENT_COMPLETED, Object.assign({
      stage: contract.STAGES.ENGAGEMENT,
      step: steps.length,
      step_count: steps.length,
      review_context_set: Boolean(reviewContext)
    }, eventContext(semantic)), 'engagement_completed');
    emit(contract.EVENTS.PAYOFF_VIEWED, Object.assign({
      stage: contract.STAGES.PAYOFF,
      review_context_set: Boolean(reviewContext)
    }, eventContext(semantic)));
    announce('Your personalized review focus is ready. ' + goal.title);
    payoff.focus({ preventScroll: true });
    if (payoff.scrollIntoView) payoff.scrollIntoView({ behavior: motionBehavior(), block: 'start' });
  }

  function revealLeadForm() {
    var semantic = contract.fromForm(form);
    var reviewContext = contract.deriveReviewContext(semantic, form.elements.review_context.value);
    if (reviewContext) form.elements.review_context.value = reviewContext;
    payoff.hidden = true;
    if (leadIntro) leadIntro.hidden = false;
    form.hidden = false;
    form.dataset.engagementComplete = 'true';
    continuity?.saveFromForm?.(form, { stage: contract.STAGES.LEAD_CAPTURE, engagementStep: steps.length, leadStep: 1 });
    try {
      document.dispatchEvent(new window.CustomEvent('408farmers:home-lead-revealed', {
        detail: { housing_context: semantic.housingContext }
      }));
    } catch (_) {}
    var section = document.querySelector('[data-home-journey-stage]');
    if (section) section.dataset.homeJourneyStage = contract.STAGES.LEAD_CAPTURE;
    emit(contract.EVENTS.PAYOFF_CONTINUED, Object.assign({
      stage: contract.STAGES.PAYOFF,
      review_context_set: Boolean(reviewContext)
    }, eventContext(semantic)), 'payoff_continued');
    announce('Quick questions complete. Save your first name and mobile number, or continue without saving.');
    var firstName = form.elements.first_name;
    if (firstName) firstName.focus({ preventScroll: true });
    if (form.scrollIntoView) form.scrollIntoView({ behavior: motionBehavior(), block: 'start' });
  }

  next.addEventListener('click', function () {
    var stepNumber = current + 1;
    var radio = selected(stepNumber);
    if (!radio || !copyAnswer(stepNumber, radio)) {
      error.hidden = false;
      steps[current].setAttribute('aria-invalid', 'true');
      announce('Please choose one option to continue.');
      var first = steps[current].querySelector('input');
      if (first) first.focus();
      return;
    }
    if (current === steps.length - 1) showPayoff();
    else showStep(current + 1, { focus: true });
  });

  back.addEventListener('click', function () {
    if (current > 0) showStep(current - 1, { focus: true });
  });

  payoffContinue.addEventListener('click', revealLeadForm);

  payoffEdit.addEventListener('click', function () {
    var semantic = semanticAnswers();
    emit(contract.EVENTS.PAYOFF_EDIT_SELECTED, Object.assign({ stage: contract.STAGES.PAYOFF }, eventContext(semantic)));
    payoff.hidden = true;
    root.hidden = false;
    var section = document.querySelector('[data-home-journey-stage]');
    if (section) section.dataset.homeJourneyStage = contract.STAGES.ENGAGEMENT;
    showStep(steps.length - 1, { focus: true });
  });

  document.addEventListener('408farmers:home-resume-requested', function () {
    var saved = continuity?.read?.();
    if (!saved || saved.stage === 'handoff_recovery') return;
    continuityStarted = true;
    continuity.restoreForm(form, saved);
    emit(contract.EVENTS.JOURNEY_RESUMED, {
      stage: saved.stage,
      resume_stage: saved.stage,
      branch: saved.branch || ''
    });
    if (saved.stage === contract.STAGES.PAYOFF) {
      showPayoff();
      return;
    }
    if (saved.stage === contract.STAGES.LEAD_CAPTURE) {
      showPayoff();
      revealLeadForm();
      return;
    }
    root.hidden = false;
    payoff.hidden = true;
    form.hidden = true;
    showStep(Math.max(0, Number(saved.engagementStep || 1) - 1), { focus: true });
  });

  root.addEventListener('change', function () {
    error.hidden = true;
    steps[current]?.removeAttribute('aria-invalid');
  });

  root.hidden = false;
  payoff.hidden = true;
  if (leadIntro) leadIntro.hidden = true;
  form.hidden = true;
  form.dataset.engagementComplete = 'false';
  emit(contract.EVENTS.ENGAGEMENT_STARTED, {
    stage: contract.STAGES.ENGAGEMENT,
    step: 1,
    step_count: steps.length
  }, 'engagement_started');
  showStep(0);

  window.HomeEngagementExperience = Object.freeze({
    build: contract.BUILD,
    isComplete: function () { return completed; }
  });
})(window, document);
