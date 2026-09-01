(function (window, document) {
  'use strict';

  var BUILD = '408-FLOW-1.5';
  var TARGET_SELECTOR = 'form[data-cro-progressive="true"]';
  var CONTACT_ROWS = [
    ['first_name', 'last_name'],
    ['phone', 'email'],
    ['property_address']
  ];

  function field(form, name) {
    return form && form.elements ? form.elements[name] || null : null;
  }

  function labelFor(form, name) {
    var control = field(form, name);
    return control && typeof control.closest === 'function' ? control.closest('label') : null;
  }

  function pushEvent(form, eventName, extra) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({
      event: eventName,
      build: BUILD,
      entry: form.dataset.cfEntry || 'lead_form',
      step: Number(form.dataset.progressiveStep || 0) + 1
    }, extra || {}));
  }

  function firstInvalid(container) {
    var controls = Array.from(container.querySelectorAll('input, select, textarea'));
    return controls.find(function (control) {
      return !control.disabled && !control.checkValidity();
    }) || null;
  }

  function focusControl(control) {
    if (!control || typeof control.focus !== 'function') return;
    try { control.focus({ preventScroll: true }); } catch (_) { control.focus(); }
  }

  function scrollToElement(element, block) {
    if (!element || typeof element.scrollIntoView !== 'function') return;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.requestAnimationFrame(function () {
      element.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: block || 'start',
        inline: 'nearest'
      });
    });
  }

  function addDescription(control, statusId) {
    if (!control || !statusId) return;
    var values = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (values.indexOf(statusId) === -1) values.push(statusId);
    control.setAttribute('aria-describedby', values.join(' '));
  }

  function clearValidation(control, statusId) {
    if (!control) return;
    control.removeAttribute('aria-invalid');
    if (!statusId) return;
    var values = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (value) {
      return value !== statusId;
    });
    if (values.length) control.setAttribute('aria-describedby', values.join(' '));
    else control.removeAttribute('aria-describedby');
  }

  function buildHeading(title, intro) {
    var heading = document.createElement('p');
    heading.className = 'cro-step-heading';
    var strong = document.createElement('strong');
    strong.textContent = title;
    var span = document.createElement('span');
    span.textContent = intro;
    heading.append(strong, span);
    return heading;
  }

  function buildProgress() {
    var progress = document.createElement('div');
    progress.className = 'cro-progress';
    progress.setAttribute('aria-label', 'Coverage Review progress');
    progress.innerHTML = [
      '<div class="cro-progress-summary"><strong data-cro-progress-current>Step 1 of 2</strong><span>About one minute</span></div>',
      '<div class="cro-progress-track" aria-hidden="true"><span></span></div>',
      '<ol class="cro-progress-list">',
      '<li data-cro-progress-item="0" data-state="active" aria-current="step"><span>1</span><b>Your situation</b></li>',
      '<li data-cro-progress-item="1" data-state="upcoming"><span>2</span><b>Contact &amp; property</b></li>',
      '</ol>'
    ].join('');
    return progress;
  }

  function createFieldset(index, className, title, intro) {
    var step = document.createElement('fieldset');
    step.className = 'cro-step ' + className;
    step.dataset.croStep = String(index);
    var legend = document.createElement('legend');
    legend.className = 'sr-only';
    legend.textContent = title;
    step.append(legend, buildHeading(title, intro));
    return step;
  }

  function removeEmptyLayout(form) {
    Array.from(form.querySelectorAll(':scope > .field-grid')).forEach(function (grid) {
      if (!grid.querySelector('input, select, textarea')) grid.remove();
    });
    Array.from(form.querySelectorAll(':scope > label')).forEach(function (label) {
      if (!label.querySelector('input, select, textarea')) label.remove();
    });
  }

  function makeRow(step, form, names) {
    var labels = names.map(function (name) { return labelFor(form, name); }).filter(Boolean);
    if (!labels.length) return;
    var row = document.createElement('div');
    row.className = labels.length > 1 ? 'field-grid' : 'cro-single-field';
    labels.forEach(function (label) { row.append(label); });
    step.append(row);
  }

  function enhance(form) {
    if (!form || form.dataset.progressiveReady === 'true') return null;
    var contextName = form.dataset.croContextField;
    var contextLabel = labelFor(form, contextName);
    var submit = form.querySelector('button[type="submit"]');
    var consent = form.querySelector(':scope > label.consent');
    var reassurance = form.querySelector(':scope > .cta-reassurance');
    var status = form.querySelector(':scope > .form-status');
    var firstVisible = form.querySelector(':scope > .field-grid, :scope > label, :scope > .cta-reassurance, :scope > button[type="submit"]');
    if (!contextLabel || !submit || !consent || !status || !firstVisible) return null;

    var progress = buildProgress();
    var shell = document.createElement('div');
    shell.className = 'cro-progressive-shell';
    var stepOne = createFieldset(
      0,
      'cro-step-context',
      form.dataset.croStepOneTitle || 'Your situation',
      form.dataset.croStepOneIntro || 'Choose the option that best matches your current situation.'
    );
    var stepTwo = createFieldset(
      1,
      'cro-step-details',
      'Where should Dylan follow up?',
      'Add your contact and property details once. They will carry into CoverageFit with your review.'
    );

    stepOne.append(contextLabel);
    var nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'primary-button';
    nextButton.dataset.croNext = 'true';
    nextButton.innerHTML = '<span>Continue</span><span aria-hidden="true">→</span>';
    var stepOneStatus = document.createElement('div');
    stepOneStatus.className = 'cro-step-status';
    stepOneStatus.dataset.croStepStatus = 'true';
    stepOneStatus.setAttribute('role', 'status');
    stepOneStatus.setAttribute('aria-live', 'polite');
    stepOneStatus.setAttribute('aria-atomic', 'true');
    stepOneStatus.id = (form.id || 'cro-progressive') + '-step-one-status';
    if (!status.id) status.id = (form.id || 'cro-progressive') + '-form-status';
    status.setAttribute('aria-atomic', 'true');
    var stepOneReassurance = document.createElement('p');
    stepOneReassurance.className = 'cro-step-reassurance';
    stepOneReassurance.textContent = 'No contact details yet. No obligation.';
    stepOne.append(nextButton, stepOneStatus, stepOneReassurance);

    CONTACT_ROWS.forEach(function (names) { makeRow(stepTwo, form, names); });
    stepTwo.append(consent);
    if (reassurance) stepTwo.append(reassurance);
    var handoffNote = document.createElement('p');
    handoffNote.className = 'cro-handoff-note';
    var professionalReview = contextName === 'occupation_segment';
    handoffNote.innerHTML = professionalReview
      ? '<strong>What happens next:</strong> Build your educational Protection Snapshot without entering the property address again. CoverageFit keeps your professional role connected so Dylan can review your coverage and verify which Farmers professional discounts may be available during quoting and underwriting.'
      : '<strong>What happens next:</strong> Build your educational Protection Snapshot without entering the property address again. It will show what looks strong and what may deserve a closer look before you review available options with Dylan.';
    stepTwo.append(handoffNote);
    var actions = document.createElement('div');
    actions.className = 'cro-step-actions';
    var backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'cro-back-button';
    backButton.dataset.croBack = 'true';
    backButton.textContent = 'Back';
    actions.append(backButton, submit);
    stepTwo.append(actions, status);

    shell.append(stepOne, stepTwo);
    form.insertBefore(progress, firstVisible);
    form.insertBefore(shell, firstVisible);
    removeEmptyLayout(form);

    var steps = [stepOne, stepTwo];
    var progressItems = Array.from(progress.querySelectorAll('[data-cro-progress-item]'));
    var currentLabel = progress.querySelector('[data-cro-progress-current]');
    var stepAnnouncer = document.createElement('div');
    stepAnnouncer.className = 'sr-only';
    stepAnnouncer.dataset.croStepAnnouncer = 'true';
    stepAnnouncer.setAttribute('role', 'status');
    stepAnnouncer.setAttribute('aria-live', 'polite');
    stepAnnouncer.setAttribute('aria-atomic', 'true');
    progress.append(stepAnnouncer);
    var card = form.closest('.quote-card');
    var hero = form.closest('.hero');
    if (hero) hero.dataset.croIntakeHero = 'true';

    function setStep(index, options) {
      var target = Math.max(0, Math.min(index, 1));
      form.dataset.progressiveStep = String(target);
      if (card) card.dataset.progressiveStep = String(target);
      if (hero) hero.dataset.croFormStep = String(target);
      steps.forEach(function (step, stepIndex) {
        var active = stepIndex === target;
        step.hidden = !active;
        step.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      progressItems.forEach(function (item, itemIndex) {
        var state = itemIndex < target ? 'complete' : itemIndex === target ? 'active' : 'upcoming';
        item.dataset.state = state;
        if (itemIndex === target) item.setAttribute('aria-current', 'step');
        else item.removeAttribute('aria-current');
      });
      currentLabel.textContent = 'Step ' + (target + 1) + ' of 2';
      var stepTitle = steps[target].querySelector('legend');
      stepAnnouncer.textContent = 'Step ' + (target + 1) + ' of 2: ' + (stepTitle ? stepTitle.textContent : 'Coverage review');
      stepOneStatus.textContent = '';
      status.textContent = '';
      if (options && options.focus) {
        var control = steps[target].querySelector('input:not([type="hidden"]), select, button');
        focusControl(control);
      }
      if (options && options.scroll) {
        scrollToElement(steps[target].querySelector('.cro-step-heading') || steps[target], 'start');
      }
      pushEvent(form, 'cro_form_step_view', { step: target + 1 });
    }

    function showInvalid(control, message) {
      var step = control && control.closest('[data-cro-step]');
      var index = step ? Number(step.dataset.croStep) : 0;
      setStep(index, { focus: false, scroll: true });
      var targetStatus = index === 0 ? stepOneStatus : status;
      targetStatus.textContent = message || 'Please complete the highlighted field to continue.';
      if (control) {
        control.setAttribute('aria-invalid', 'true');
        addDescription(control, targetStatus.id);
      }
      focusControl(control);
      scrollToElement(control || targetStatus, 'center');
      pushEvent(form, 'cro_form_validation_error', {
        step: index + 1,
        field: control && control.name ? control.name : 'unknown'
      });
    }

    nextButton.addEventListener('click', function () {
      var invalid = firstInvalid(stepOne);
      if (invalid) {
        showInvalid(invalid, 'Please choose the option that best matches your situation.');
        return;
      }
      pushEvent(form, 'cro_form_step_complete', { step: 1, context_field: contextName });
      setStep(1, { focus: true, scroll: true });
    });

    backButton.addEventListener('click', function () {
      pushEvent(form, 'cro_form_back', { from_step: 2 });
      setStep(0, { focus: true, scroll: true });
    });

    function clearControlValidation(event) {
      var control = event.target;
      if (!control || !control.matches('input, select, textarea')) return;
      var step = control.closest('[data-cro-step]');
      var targetStatus = step && Number(step.dataset.croStep) === 0 ? stepOneStatus : status;
      if (control.checkValidity()) {
        clearValidation(control, targetStatus.id);
        if (targetStatus.textContent) targetStatus.textContent = '';
      }
    }

    form.addEventListener('input', clearControlValidation);
    form.addEventListener('change', clearControlValidation);

    form.addEventListener('submit', function (event) {
      var current = Number(form.dataset.progressiveStep || 0);
      if (current === 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        nextButton.click();
        return;
      }
      var invalid = firstInvalid(form);
      if (invalid) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showInvalid(invalid);
        return;
      }
      pushEvent(form, 'cro_form_submit_attempt', { step: 2 });
    }, true);

    form.dataset.progressiveReady = 'true';
    form.dataset.progressiveBuild = BUILD;
    setStep(0, { focus: false, scroll: false });
    pushEvent(form, 'cro_form_start', { context_field: contextName });
    return { form: form, steps: steps, setStep: setStep };
  }

  function initAll() {
    return Array.from(document.querySelectorAll(TARGET_SELECTOR)).map(enhance).filter(Boolean);
  }

  window.CROProgressiveIntake = {
    build: BUILD,
    enhance: enhance,
    initAll: initAll
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll, { once: true });
  else initAll();
})(window, document);
