(function (window, document) {
  'use strict';

  var BUILD = '408-FLOW-2.3';
  var SEMANTIC_FIELDS = Object.freeze([
    'home_review_goal',
    'housing_context',
    'review_timing'
  ]);
  var LEAD_STATUS = Object.freeze({
    confirmed: Object.freeze({
      kicker: 'Request received',
      copy: 'I have the contact and property details you submitted. A few quick answers will help me focus the review around what matters to you.'
    }),
    pending: Object.freeze({
      kicker: 'Request sent',
      copy: 'Your request is still being confirmed in the background. You can answer three quick questions while it finishes.'
    }),
    unconfirmed: Object.freeze({
      kicker: 'Details saved',
      copy: 'Delivery could not be confirmed yet, but your details are saved in this tab. You can keep going or contact Dylan directly.'
    }),
    'local-fallback': Object.freeze({
      kicker: 'Details saved',
      copy: 'Your details are saved in this browser. You can keep going now, and Dylan’s direct contact options remain available.'
    })
  });

  var QUESTIONS = Object.freeze([
    Object.freeze({
      field: 'home_review_goal',
      legend: 'What would make this review most useful?',
      helper: 'Choose the result you care about most right now.',
      options: Object.freeze([
        Object.freeze({ value: 'farmers_fit', title: 'See whether Farmers may be a fit', copy: 'Explore whether available Farmers options are worth comparing.' }),
        Object.freeze({ value: 'coverage_fit', title: 'Check whether my current protection still fits', copy: 'Organize the coverage areas that may deserve a closer look.' }),
        Object.freeze({ value: 'home_auto_bundle', title: 'Explore home and auto together', copy: 'See whether reviewing both policies together could make sense.' }),
        Object.freeze({ value: 'exploring', title: 'I’m just exploring', copy: 'Start with a low-pressure look at your options.' })
      ])
    }),
    Object.freeze({
      field: 'housing_context',
      legend: 'Which situation should Dylan keep in mind?',
      helper: 'This keeps the next step relevant to the property you want reviewed.',
      options: Object.freeze([
        Object.freeze({ value: 'owner_occupied', title: 'I own and live here', copy: 'Focus on protection for your primary residence.' }),
        Object.freeze({ value: 'landlord', title: 'I own and rent it out', copy: 'Keep landlord-specific needs in view.' }),
        Object.freeze({ value: 'buyer', title: 'I’m buying this home', copy: 'Align the review with an upcoming purchase.' }),
        Object.freeze({ value: 'renter', title: 'I rent my home', copy: 'Continue to renters-specific options instead of a homeowner assessment.' })
      ])
    }),
    Object.freeze({
      field: 'review_timing',
      legend: 'When would you like to understand your options?',
      helper: 'Your answer helps Dylan match the review to your timing.',
      options: Object.freeze([
        Object.freeze({ value: 'shopping_now', title: 'I’m comparing options now', copy: 'Get organized for a near-term review.' }),
        Object.freeze({ value: 'renewal_60', title: 'My renewal is within 60 days', copy: 'Review the fit before your next policy term.' }),
        Object.freeze({ value: 'later', title: 'Later this year', copy: 'Get a head start now and decide when to compare.' }),
        Object.freeze({ value: 'not_sure', title: 'I’m not sure', copy: 'Dylan can help identify a practical next step.' })
      ])
    })
  ]);

  var GOAL_PAYOFF = Object.freeze({
    farmers_fit: Object.freeze({ title: 'A focused Farmers fit review', copy: 'CoverageFit can organize your current protection before Dylan evaluates available Farmers options and discounts.' }),
    coverage_fit: Object.freeze({ title: 'A clearer view of your current protection', copy: 'CoverageFit can surface the areas you understand and the details worth verifying with Dylan.' }),
    home_auto_bundle: Object.freeze({ title: 'A coordinated home and auto conversation', copy: 'Your Protection Score can give Dylan useful home context before any bundle discussion.' }),
    exploring: Object.freeze({ title: 'A low-pressure place to start', copy: 'CoverageFit lets you learn what to review without committing to a quote or coverage change.' })
  });
  var HOUSING_PAYOFF = Object.freeze({
    owner_occupied: 'Primary residence',
    landlord: 'Rental property',
    buyer: 'Upcoming home purchase',
    renter: 'Renter-specific review'
  });
  var TIMING_PAYOFF = Object.freeze({
    shopping_now: 'Comparing now',
    renewal_60: 'Renewal within 60 days',
    later: 'Planning for later this year',
    not_sure: 'Timing to decide with Dylan'
  });

  var form = document.querySelector('form[data-post-lead-engagement="true"]');
  if (!form) return;

  var state = {
    step: 0,
    answers: Object.create(null),
    leadCaptureStatus: 'unconfirmed',
    onContinue: null,
    presented: false,
    completed: false
  };

  function ensureHiddenField(name) {
    if (form.elements[name]) return form.elements[name];
    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    form.appendChild(input);
    return input;
  }

  var initialHousingControl = form.elements.housing_context;
  if (initialHousingControl && initialHousingControl.tagName === 'SELECT') {
    initialHousingControl.name = 'initial_housing_context';
  }
  SEMANTIC_FIELDS.forEach(ensureHiddenField);

  var panel = document.createElement('section');
  panel.className = 'post-lead-engagement';
  panel.dataset.postLeadEngagementPanel = '';
  panel.hidden = true;
  panel.tabIndex = -1;
  panel.setAttribute('aria-labelledby', 'post-lead-title');
  panel.innerHTML = [
    '<div class="post-lead-receipt">',
      '<img class="post-lead-human-portrait" src="/shared/images/dylan-headshot-160.webp" width="52" height="52" alt="Dylan Haysbert" decoding="async">',
      '<div><div class="post-lead-kicker" data-post-lead-kicker>Request received</div>',
      '<strong data-post-lead-human-title>Thanks — I have your request.</strong>',
      '<p data-post-lead-receipt-copy></p></div>',
    '</div>',
    '<div class="post-lead-live sr-only" data-post-lead-live role="status" aria-live="polite" aria-atomic="true"></div>',
    '<div data-post-lead-question-stage>',
      '<div class="post-lead-progress-row">',
        '<span data-post-lead-progress-label>Quick questions · 1 of 3</span>',
        '<span class="post-lead-progress-track" role="progressbar" aria-label="Post-lead question progress" aria-valuemin="1" aria-valuemax="3" aria-valuenow="1"><span data-post-lead-progress-bar></span></span>',
      '</div>',
      '<h2 id="post-lead-title">A few quick questions will help me focus the review.</h2>',
      '<p class="post-lead-intro"><strong>You’re not submitting another request.</strong> These answers only help me understand what matters most to you.</p>',
      '<form class="post-lead-question-form" data-post-lead-question-form novalidate></form>',
      '<p class="post-lead-error" data-post-lead-error role="alert" hidden>Please choose one option to continue.</p>',
      '<div class="post-lead-actions">',
        '<button class="post-lead-back" type="button" data-post-lead-back hidden>Back</button>',
        '<button class="primary-button post-lead-next" type="button" data-post-lead-next><span>Continue</span><span aria-hidden="true">→</span></button>',
      '</div>',
    '</div>',
    '<div class="post-lead-payoff" data-post-lead-payoff hidden>',
      '<div class="post-lead-kicker">Here’s where I’d start</div>',
      '<h2 data-post-lead-payoff-title>Your review has a clear starting point.</h2>',
      '<p data-post-lead-payoff-copy></p>',
      '<div class="post-lead-summary" aria-label="Your review context">',
        '<div><span>Property</span><strong data-post-lead-housing></strong></div>',
        '<div><span>Timing</span><strong data-post-lead-timing></strong></div>',
      '</div>',
      '<div class="post-lead-next-step" data-post-lead-next-step>',
        '<strong>Your request is already complete.</strong>',
        '<p>You can stop here or review the optional next step for getting a head start on Dylan’s review.</p>',
      '</div>',
      '<div class="post-lead-payoff-actions">',
        '<button class="primary-button" type="button" data-post-lead-review-options><span>Review My Next-Step Options</span><span aria-hidden="true">→</span></button>',
        '<button class="post-lead-secondary" type="button" data-post-lead-later>Not now — Dylan can follow up</button>',
        '<button class="post-lead-edit" type="button" data-post-lead-edit>Change my answers</button>',
      '</div>',
      '<p class="post-lead-disclosure">CoverageFit is educational, not a quote, eligibility decision, or coverage determination.</p>',
    '</div>',
    '<div class="post-lead-finished" data-post-lead-finished hidden>',
      '<div class="post-lead-kicker">You’re all set</div>',
      '<h2>I have what I need for now.</h2>',
      '<p>Your request is saved. If a call would be easiest, you can choose an exact time now.</p>',
      '<div data-post-lead-callback-slot hidden></div>',
      '<div class="post-lead-contact-actions">',
        '<a href="sms:+14083276377">Text Dylan</a>',
        '<a href="tel:+14083276377">Call Dylan</a>',
      '</div>',
    '</div>'
  ].join('');

  form.insertAdjacentElement('afterend', panel);

  var questionStage = panel.querySelector('[data-post-lead-question-stage]');
  var questionForm = panel.querySelector('[data-post-lead-question-form]');
  var payoff = panel.querySelector('[data-post-lead-payoff]');
  var finished = panel.querySelector('[data-post-lead-finished]');
  var live = panel.querySelector('[data-post-lead-live]');
  var error = panel.querySelector('[data-post-lead-error]');
  var back = panel.querySelector('[data-post-lead-back]');
  var next = panel.querySelector('[data-post-lead-next]');
  var progressLabel = panel.querySelector('[data-post-lead-progress-label]');
  var progressTrack = panel.querySelector('[role="progressbar"]');
  var progressBar = panel.querySelector('[data-post-lead-progress-bar]');

  function safeStatus(value) {
    return Object.prototype.hasOwnProperty.call(LEAD_STATUS, value) ? value : 'unconfirmed';
  }

  function normalizeInitialHousing(value) {
    var normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    if (normalized === 'owner_occupied' || /^i own/.test(normalized)) return 'owner_occupied';
    if (normalized === 'landlord') return 'landlord';
    if (normalized === 'buyer' || /buying/.test(normalized)) return 'buyer';
    if (normalized === 'renter' || /^i rent/.test(normalized)) return 'renter';
    return '';
  }

  function focusPanel() {
    try { panel.focus({ preventScroll: true }); } catch (_) { panel.focus(); }
    try {
      panel.scrollIntoView({
        behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center'
      });
    } catch (_) {}
  }

  function emit(eventName, properties) {
    var detail = Object.assign({
      build: BUILD,
      entry: form.dataset.cfEntry || 'lead_form',
      lead_capture_status: state.leadCaptureStatus
    }, properties || {});
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: eventName }, detail));
    if (typeof window.CustomEvent === 'function') {
      document.dispatchEvent(new window.CustomEvent('408farmers:' + eventName, { detail: detail }));
    }
  }

  function selectedValue(question) {
    var checked = questionForm.querySelector('input[name="post_lead_' + question.field + '"]:checked');
    return checked ? checked.value : '';
  }

  function renderQuestion() {
    var question = QUESTIONS[state.step];
    questionForm.textContent = '';
    var fieldset = document.createElement('fieldset');
    fieldset.className = 'post-lead-fieldset';
    var legend = document.createElement('legend');
    legend.textContent = question.legend;
    fieldset.appendChild(legend);
    var helper = document.createElement('p');
    helper.className = 'post-lead-helper';
    helper.textContent = question.helper;
    fieldset.appendChild(helper);
    var options = document.createElement('div');
    options.className = 'post-lead-options';

    question.options.forEach(function (option) {
      var label = document.createElement('label');
      label.className = 'post-lead-option';
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'post_lead_' + question.field;
      input.value = option.value;
      input.checked = state.answers[question.field] === option.value;
      var copy = document.createElement('span');
      var strong = document.createElement('strong');
      strong.textContent = option.title;
      var small = document.createElement('small');
      small.textContent = option.copy;
      copy.appendChild(strong);
      copy.appendChild(small);
      label.appendChild(input);
      label.appendChild(copy);
      options.appendChild(label);
    });
    fieldset.appendChild(options);
    questionForm.appendChild(fieldset);

    var number = state.step + 1;
    progressLabel.textContent = 'Quick questions · ' + number + ' of ' + QUESTIONS.length;
    progressTrack.setAttribute('aria-valuenow', String(number));
    progressBar.style.width = String((number / QUESTIONS.length) * 100) + '%';
    back.hidden = state.step === 0;
    next.querySelector('span:first-child').textContent = state.step === QUESTIONS.length - 1 ? 'See My Next Step' : 'Continue';
    error.hidden = true;
    live.textContent = 'Question ' + number + ' of ' + QUESTIONS.length + ': ' + question.legend;
  }

  function writeAnswers() {
    SEMANTIC_FIELDS.forEach(function (field) {
      ensureHiddenField(field).value = state.answers[field] || '';
    });
    var reviewContext = form.elements.review_context;
    if (reviewContext && window.HomeJourneyContract && typeof window.HomeJourneyContract.deriveReviewContext === 'function') {
      reviewContext.value = window.HomeJourneyContract.deriveReviewContext({
        home_review_goal: state.answers.home_review_goal,
        housing_context: state.answers.housing_context,
        review_timing: state.answers.review_timing
      }) || reviewContext.value;
    }
    var profile = window.ProspectProfileBuilder?.fromForm?.(form);
    if (profile) window.ProspectProfileBuilder?.save?.(profile);
  }

  function showPayoff() {
    writeAnswers();
    state.completed = true;
    questionStage.hidden = true;
    finished.hidden = true;
    payoff.hidden = false;
    var goal = GOAL_PAYOFF[state.answers.home_review_goal] || GOAL_PAYOFF.exploring;
    panel.querySelector('[data-post-lead-payoff-title]').textContent = goal.title;
    panel.querySelector('[data-post-lead-payoff-copy]').textContent = goal.copy;
    panel.querySelector('[data-post-lead-housing]').textContent = HOUSING_PAYOFF[state.answers.housing_context] || 'Property context saved';
    panel.querySelector('[data-post-lead-timing]').textContent = TIMING_PAYOFF[state.answers.review_timing] || 'Timing saved';

    var renter = state.answers.housing_context === 'renter';
    var nextStep = panel.querySelector('[data-post-lead-next-step]');
    if (renter) {
      nextStep.querySelector('strong').textContent = 'Your request is already complete.';
      nextStep.querySelector('p').textContent = 'You can stop here or review the optional renter-specific next step. You will not be sent into the homeowner assessment.';
    } else {
      nextStep.querySelector('strong').textContent = 'Your request is already complete.';
      nextStep.querySelector('p').textContent = 'You can stop here or review the optional Protection Score and a Home Protection Snapshot you can save as a PDF or print.';
    }
    live.textContent = 'Your personalized next step is ready.';
    emit('post_lead_payoff_viewed', {
      home_review_goal: state.answers.home_review_goal,
      housing_context: state.answers.housing_context,
      review_timing: state.answers.review_timing,
      destination_type: renter ? 'renters' : 'coveragefit'
    });
    focusPanel();
  }

  function present(options) {
    var settings = options || {};
    if (state.presented || typeof settings.onContinue !== 'function') return false;
    state.presented = true;
    state.leadCaptureStatus = safeStatus(settings.leadCaptureStatus);
    state.onContinue = settings.onContinue;
    var initialHousing = form.elements.initial_housing_context
      ? form.elements.initial_housing_context.value
      : '';
    if (!initialHousing && String(form.dataset.cfEntry || '').indexOf('buyer_') === 0) initialHousing = 'buyer';
    state.answers.housing_context = normalizeInitialHousing(initialHousing);
    var receipt = LEAD_STATUS[state.leadCaptureStatus];
    panel.querySelector('[data-post-lead-kicker]').textContent = receipt.kicker;
    panel.querySelector('[data-post-lead-receipt-copy]').textContent = receipt.copy;
    var humanTitle = panel.querySelector('[data-post-lead-human-title]');
    if (humanTitle) {
      humanTitle.textContent = state.leadCaptureStatus === 'confirmed'
        ? 'Thanks — I have your request.'
        : (state.leadCaptureStatus === 'pending'
          ? 'Thanks — your request is on its way.'
          : 'You can keep going from here.');
    }
    form.hidden = true;
    form.setAttribute('aria-hidden', 'true');
    var intro = document.querySelector('[data-home-lead-intro]');
    var legacyEngagement = document.querySelector('[data-home-engagement]');
    var legacyPayoff = document.querySelector('[data-home-payoff]');
    var legacyConfirmation = document.querySelector('[data-home-confirmation-panel]');
    if (intro) intro.hidden = true;
    if (legacyEngagement) legacyEngagement.hidden = true;
    if (legacyPayoff) legacyPayoff.hidden = true;
    if (legacyConfirmation) legacyConfirmation.hidden = true;
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    questionStage.hidden = false;
    payoff.hidden = true;
    finished.hidden = true;
    renderQuestion();
    emit('post_lead_engagement_viewed', { question_number: 1 });
    focusPanel();
    return true;
  }

  next.addEventListener('click', function () {
    var question = QUESTIONS[state.step];
    var value = selectedValue(question);
    if (!value) {
      error.hidden = false;
      live.textContent = error.textContent;
      var first = questionForm.querySelector('input[type="radio"]');
      if (first) first.focus();
      return;
    }
    state.answers[question.field] = value;
    error.hidden = true;
    emit('post_lead_question_answered', { question_field: question.field, question_number: state.step + 1, answer: value });
    if (state.step === QUESTIONS.length - 1) {
      showPayoff();
      return;
    }
    state.step += 1;
    renderQuestion();
  });

  back.addEventListener('click', function () {
    if (state.step === 0) return;
    state.step -= 1;
    renderQuestion();
  });

  panel.querySelector('[data-post-lead-edit]').addEventListener('click', function () {
    payoff.hidden = true;
    questionStage.hidden = false;
    state.step = 0;
    renderQuestion();
    focusPanel();
  });

  panel.querySelector('[data-post-lead-review-options]').addEventListener('click', function () {
    if (typeof state.onContinue !== 'function') return;
    var destinationType = state.answers.housing_context === 'renter' ? 'renters' : 'coveragefit';
    emit('post_lead_invitation_requested', {
      home_review_goal: state.answers.home_review_goal,
      housing_context: state.answers.housing_context,
      review_timing: state.answers.review_timing,
      destination_type: destinationType
    });
    var invitationStarted = window.CoverageFitInvitation
      && typeof window.CoverageFitInvitation.present === 'function'
      && window.CoverageFitInvitation.present({
        leadCaptureStatus: state.leadCaptureStatus,
        destinationType: destinationType,
        onContinue: state.onContinue,
        onBack: function () {
          panel.hidden = false;
          panel.setAttribute('aria-hidden', 'false');
          payoff.hidden = false;
          finished.hidden = true;
          focusPanel();
        }
      });
    if (!invitationStarted) {
      // An explicit click still authorizes continuation if the optional
      // invitation asset is unavailable. There is never a timed launch.
      state.onContinue();
    }
  });

  panel.querySelector('[data-post-lead-later]').addEventListener('click', function () {
    payoff.hidden = true;
    finished.hidden = false;
    live.textContent = 'Your request is complete. You can choose a callback time or coordinate with Dylan later.';
    emit('post_lead_continuation_deferred', {
      home_review_goal: state.answers.home_review_goal,
      housing_context: state.answers.housing_context,
      review_timing: state.answers.review_timing
    });
    var callbackSlot = finished.querySelector('[data-post-lead-callback-slot]');
    if (window.CallbackSchedulingContinuity && typeof window.CallbackSchedulingContinuity.mount === 'function') {
      window.CallbackSchedulingContinuity.mount(callbackSlot, {
        form: form,
        productType: (form.dataset && form.dataset.cfEntry) || window.location.pathname,
        correlationId: form.elements.lead_checkpoint_id ? form.elements.lead_checkpoint_id.value : '',
        sourceRoute: window.location.pathname
      });
    }
    focusPanel();
  });

  window.PostLeadEngagement = Object.freeze({
    BUILD: BUILD,
    semanticFields: SEMANTIC_FIELDS,
    questions: QUESTIONS,
    present: present
  });
})(window, document);
