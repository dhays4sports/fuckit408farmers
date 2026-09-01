/* 408-LIFE-1.8 — engagement + split-vault application-initialization UI. Network transport lives only in life-secure-submit.js. */
(function (window, document) {
  'use strict';

  var BUILD = '408-LIFE-1.8';
  var TITLES = [
    'What matters most',
    'Financial resilience',
    'Current protection',
    'About you',
    'Contact & residence',
    'Identity verification'
  ];

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function focusSection(target) {
    if (!target) return;
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(function () {
      try { target.focus({ preventScroll: true }); } catch (error) { target.focus(); }
    }, prefersReducedMotion() ? 0 : 300);
  }

  function emitProgress(step, phase, completed) {
    if (typeof window.CustomEvent !== 'function') return;
    document.dispatchEvent(new window.CustomEvent('life:intake-progress', {
      detail: { step: step, phase: phase, completed: !!completed, build: BUILD }
    }));
  }

  function initStartLinks() {
    var start = document.getElementById('life-start');
    document.querySelectorAll('[data-life-start]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        if (!start) return;
        event.preventDefault();
        focusSection(start);
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search + '#life-start');
        }
      });
    });
  }

  function initIntake() {
    var shell = document.querySelector('[data-life-intake]');
    var form = document.querySelector('[data-life-intake-form]');
    if (!shell || !form) return;

    var steps = Array.prototype.slice.call(form.querySelectorAll('[data-life-step]'));
    var applicationIntro = shell.querySelector('[data-life-application-intro]');
    var complete = shell.querySelector('[data-life-complete]');
    var progressLabel = shell.querySelector('[data-life-progress-label]');
    var progressTitle = shell.querySelector('[data-life-progress-title]');
    var progressBar = shell.querySelector('[data-life-progress-bar]');
    var live = shell.querySelector('[data-life-live]');
    var currentIndex = 0;

    shell.setAttribute('data-life-intake-enhanced', 'true');

    try {
      var tableMode = new window.URLSearchParams(window.location.search).get('event') === 'table';
      if (tableMode) {
        document.body.dataset.lifeEventMode = 'table';
        form.setAttribute('autocomplete', 'off');
        form.querySelectorAll('[data-life-phase="application"] input').forEach(function (input) { input.setAttribute('autocomplete', 'off'); });
      }
    } catch (ignore) { /* progressive enhancement only */ }

    function currentStep() { return steps[currentIndex] || null; }
    function stepNumber(step) { return Number(step && step.getAttribute('data-life-step')) || 1; }
    function phaseFor(index) { return index < 3 ? 'engagement' : 'application'; }
    function phaseIndex(index) { return index < 3 ? index : index - 3; }
    function phaseCount() { return 3; }

    function setApplicationFieldsEnabled(enabled) {
      form.querySelectorAll('[data-life-phase="application"] input').forEach(function (input) {
        input.disabled = !enabled;
      });
    }

    function selectedInputs(step) {
      if (!step) return [];
      return Array.prototype.slice.call(step.querySelectorAll('input[type="checkbox"]:checked,input[type="radio"]:checked'));
    }

    function trimmedValue(selector, step) {
      var input = step && step.querySelector(selector);
      return input ? String(input.value || '').trim() : '';
    }

    function validDateOfBirth(step) {
      var value = trimmedValue('[data-life-dob]', step);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      var dob = new Date(value + 'T12:00:00');
      if (Number.isNaN(dob.getTime())) return false;
      var now = new Date();
      if (dob >= now) return false;
      var oldest = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
      return dob >= oldest;
    }

    function validEmail(step) {
      var input = step && step.querySelector('[data-life-email]');
      return !!(input && input.value.trim() && input.validity.valid);
    }

    function validPhone(step) {
      var input = step && step.querySelector('[data-life-phone]');
      if (!input) return true;
      var value = input.value.trim();
      if (!value) return true;
      return value.replace(/\D/g, '').length >= 10;
    }

    function validZip(step) {
      var value = trimmedValue('[data-life-zip]', step);
      return /^\d{5}(?:-\d{4})?$/.test(value);
    }

    function validRequiredText(step) {
      return Array.prototype.slice.call(step.querySelectorAll('[data-life-required]')).every(function (input) {
        return String(input.value || '').trim().length > 0;
      });
    }

    function validGender(step) {
      if (!step.querySelector('[data-life-required-group="gender"]')) return true;
      return !!step.querySelector('input[name="gender"]:checked');
    }

    function validLast4(step) {
      var value = trimmedValue('[data-life-ssn-last4]', step);
      return /^\d{4}$/.test(value);
    }

    function validAcknowledgement(step) {
      var input = step && step.querySelector('[data-life-application-ack]');
      return !input || input.checked;
    }

    function isValid(step) {
      if (!step) return false;
      var number = stepNumber(step);
      if (number <= 3) return selectedInputs(step).length > 0;
      if (number === 4) return validRequiredText(step) && validGender(step);
      if (number === 5) return validRequiredText(step) && validZip(step) && validEmail(step) && validPhone(step);
      if (number === 6) return validDateOfBirth(step) && validLast4(step) && validAcknowledgement(step);
      return false;
    }

    function syncChoiceStyles(step) {
      if (!step) return;
      step.querySelectorAll('.life-choice-card').forEach(function (card) {
        var input = card.querySelector('input');
        card.classList.toggle('is-selected', !!(input && input.checked));
      });
    }

    function syncValidityStyles(step) {
      if (!step || stepNumber(step) <= 3) return;
      step.querySelectorAll('input').forEach(function (input) {
        input.removeAttribute('aria-invalid');
      });
    }

    function syncControls(step) {
      if (!step) return;
      syncChoiceStyles(step);
      syncValidityStyles(step);
      var valid = isValid(step);
      step.querySelectorAll('[data-life-next],[data-life-secure-submit],[data-life-finish-later]').forEach(function (button) {
        button.disabled = !valid;
        button.setAttribute('aria-disabled', valid ? 'false' : 'true');
      });
      if (valid) {
        var error = shell.querySelector('[data-life-error="' + stepNumber(step) + '"]');
        if (error) error.hidden = true;
      }
    }

    function announce(message) {
      if (!live) return;
      live.textContent = '';
      window.setTimeout(function () { live.textContent = message; }, 10);
    }

    function setProgress(index, mode) {
      var phase = phaseFor(index);
      var number = phaseIndex(index) + 1;
      if (mode === 'intro') {
        if (progressLabel) progressLabel.textContent = 'Quick questions complete';
        if (progressTitle) progressTitle.textContent = 'Application details are next';
        if (progressBar) progressBar.style.width = '100%';
        return;
      }
      if (mode === 'complete') {
        if (progressLabel) progressLabel.textContent = 'Application details checked';
        if (progressTitle) progressTitle.textContent = 'Secure handoff is next';
        if (progressBar) progressBar.style.width = '100%';
        return;
      }
      if (progressLabel) progressLabel.textContent = (phase === 'engagement' ? 'Quick questions' : 'Application details') + ' · ' + number + ' of ' + phaseCount();
      if (progressTitle) progressTitle.textContent = TITLES[index] || 'Application start';
      if (progressBar) progressBar.style.width = String((number / phaseCount()) * 100) + '%';
    }

    function showStep(index, options) {
      var opts = options || {};
      currentIndex = Math.max(0, Math.min(index, steps.length - 1));
      if (applicationIntro) applicationIntro.hidden = true;
      if (complete) complete.hidden = true;
      form.hidden = false;
      steps.forEach(function (step, i) { step.hidden = i !== currentIndex; });
      setProgress(currentIndex);
      syncControls(currentStep());
      var phase = phaseFor(currentIndex);
      announce((phase === 'engagement' ? 'Quick question ' : 'Application detail ') + (phaseIndex(currentIndex) + 1) + ' of 3. ' + (TITLES[currentIndex] || 'Application start') + '.');
      if (opts.focus !== false) focusSection(currentStep());
      emitProgress(currentIndex + 1, phase, false);
    }

    function markInvalid(step) {
      if (!step || stepNumber(step) <= 3) return;
      if (stepNumber(step) === 4) {
        step.querySelectorAll('[data-life-required]').forEach(function (input) { if (!input.value.trim()) input.setAttribute('aria-invalid', 'true'); });
      }
      if (stepNumber(step) === 5) {
        step.querySelectorAll('[data-life-required]').forEach(function (input) { if (!input.value.trim()) input.setAttribute('aria-invalid', 'true'); });
        var zip = step.querySelector('[data-life-zip]');
        var email = step.querySelector('[data-life-email]');
        var phone = step.querySelector('[data-life-phone]');
        if (zip && !validZip(step)) zip.setAttribute('aria-invalid', 'true');
        if (email && !validEmail(step)) email.setAttribute('aria-invalid', 'true');
        if (phone && !validPhone(step)) phone.setAttribute('aria-invalid', 'true');
      }
      if (stepNumber(step) === 6) {
        var dob = step.querySelector('[data-life-dob]');
        var last4 = step.querySelector('[data-life-ssn-last4]');
        if (dob && !validDateOfBirth(step)) dob.setAttribute('aria-invalid', 'true');
        if (last4 && !validLast4(step)) last4.setAttribute('aria-invalid', 'true');
      }
    }

    function showError(step) {
      var error = shell.querySelector('[data-life-error="' + stepNumber(step) + '"]');
      markInvalid(step);
      if (error) {
        error.hidden = false;
        announce(error.textContent);
      }
    }

    function showApplicationIntro() {
      steps.forEach(function (step) { step.hidden = true; });
      form.hidden = true;
      if (complete) complete.hidden = true;
      if (applicationIntro) applicationIntro.hidden = false;
      setProgress(2, 'intro');
      announce('Quick questions complete. Application details are next.');
      focusSection(applicationIntro);
      emitProgress(3, 'engagement', true);
    }

    function clearApplicationFields() {
      form.querySelectorAll('[data-life-phase="application"] input').forEach(function (input) {
        if (input.type === 'checkbox' || input.type === 'radio') input.checked = false;
        else input.value = '';
        input.removeAttribute('aria-invalid');
      });
    }

    function finishSecureSubmission(event) {
      var mode = event && event.detail ? event.detail.mode : 'carrier_application_start';
      var later = mode === 'finish_with_dylan_later';
      clearApplicationFields();
      setApplicationFieldsEnabled(false);
      steps.forEach(function (step) { step.hidden = true; });
      form.hidden = true;
      if (applicationIntro) applicationIntro.hidden = true;
      if (complete) complete.hidden = false;
      setProgress(5, 'complete');
      var title = complete && complete.querySelector('[data-life-complete-title]');
      var description = complete && complete.querySelector('[data-life-complete-description]');
      var next = complete && complete.querySelector('[data-life-complete-next]');
      var callbackSlot = complete && complete.querySelector('[data-life-callback-slot]');
      if (title) title.textContent = later ? 'Dylan has what he needs to follow up.' : 'Your application-start details were received.';
      if (description) description.textContent = later
        ? 'Your contact, residence, and review context were securely received. No date of birth or Social Security digits were sent in this follow-up mode.'
        : 'The dedicated LIFE endpoint accepted the application-start information and placed it in Dylan’s protected producer application queue. Your application is not yet in force.';
      if (next) next.textContent = later
        ? 'Dylan can contact you to finish the carrier-required details through an appropriate protected process.'
        : 'Dylan can open your application start in the protected producer queue, reveal the carrier-required details once, initiate the Farmers application, and send the carrier application link to the email you provided.';
      if (callbackSlot) callbackSlot.hidden = true;
      if (later && callbackSlot && event.detail.callbackContext && window.CallbackSchedulingContinuity && typeof window.CallbackSchedulingContinuity.mount === 'function') {
        window.CallbackSchedulingContinuity.mount(callbackSlot, event.detail.callbackContext);
      }
      announce(later ? 'Your follow-up request was securely received without sensitive identity values.' : 'Application-start details were securely received.');
      focusSection(complete);
      emitProgress(6, 'application', true);
    }

    function handleProtectionExclusivity(changed) {
      if (!changed || changed.type !== 'checkbox' || changed.name !== 'protection_priority' || !changed.checked) return;
      var group = Array.prototype.slice.call(form.querySelectorAll('input[type="checkbox"][name="protection_priority"]'));
      if (changed.hasAttribute('data-life-exclusive')) {
        group.forEach(function (input) { if (input !== changed) input.checked = false; });
      } else {
        group.forEach(function (input) { if (input.hasAttribute('data-life-exclusive')) input.checked = false; });
      }
    }

    form.addEventListener('submit', function (event) { event.preventDefault(); });

    form.addEventListener('input', function (event) {
      var step = event.target && event.target.closest('[data-life-step]');
      if (step) syncControls(step);
    });

    form.addEventListener('change', function (event) {
      var input = event.target;
      if (!input) return;
      if (/^(checkbox|radio)$/.test(input.type)) handleProtectionExclusivity(input);
      var step = input.closest('[data-life-step]');
      if (step) syncControls(step);
    });

    form.addEventListener('click', function (event) {
      var finishLater = event.target.closest('[data-life-finish-later]');
      if (finishLater) {
        var finishStep = finishLater.closest('[data-life-step]');
        if (!finishStep || !isValid(finishStep)) {
          showError(finishStep);
          return;
        }
        document.dispatchEvent(new window.CustomEvent('life:finish-later-requested', { detail: { build: BUILD } }));
        return;
      }

      var next = event.target.closest('[data-life-next]');
      if (next) {
        var step = next.closest('[data-life-step]');
        if (!step || !isValid(step)) {
          showError(step);
          return;
        }
        if (currentIndex === 2) showApplicationIntro();
        else showStep(currentIndex + 1);
        return;
      }

      var back = event.target.closest('[data-life-back]');
      if (back) {
        if (currentIndex === 3) showApplicationIntro();
        else showStep(currentIndex - 1);
      }
    });

    var applicationStart = shell.querySelector('[data-life-application-start]');
    if (applicationStart) applicationStart.addEventListener('click', function () {
      setApplicationFieldsEnabled(true);
      showStep(3);
    });

    var review = shell.querySelector('[data-life-review]');
    if (review) review.addEventListener('click', function () { showStep(0); });

    document.addEventListener('life:secure-submission-complete', finishSecureSubmission);

    window.addEventListener('pagehide', function () {
      clearApplicationFields();
      setApplicationFieldsEnabled(false);
    });
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) {
        clearApplicationFields();
        setApplicationFieldsEnabled(false);
      }
    });

    setApplicationFieldsEnabled(false);
    steps.forEach(function (step) { syncControls(step); });
    showStep(0, { focus: false });
  }

  function init() {
    if (!document.body || !document.body.classList.contains('life-page')) return;
    document.body.dataset.lifeBuild = BUILD;
    document.body.dataset.lifeFoundationReady = 'true';
    document.body.dataset.lifeEngagementReady = 'true';
    document.body.dataset.lifeApplicationInitializationReady = 'true';
    initStartLinks();
    initIntake();
  }

  window.LifeApplicationInitialization = { build: BUILD, init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window, document);
