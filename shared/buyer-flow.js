(function (window, document) {
  'use strict';

  var module = window.Farmers408BuyerReferral;
  var form = document.getElementById('leadForm');
  if (!form || !module) return;

  var context = module.resolve(window.location.search || '');
  var textLinks = Array.from(document.querySelectorAll('[data-buyer-text-link]'));
  var referralBanner = document.querySelector('[data-buyer-referral]');
  var referralName = referralBanner && referralBanner.querySelector('[data-buyer-referral-name]');
  var steps = Array.from(form.querySelectorAll('[data-buyer-step]'));
  var progressItems = Array.from(document.querySelectorAll('[data-buyer-progress]'));
  var status = document.getElementById('formStatus');
  var currentStep = 0;
  var stepAnnouncer = document.createElement('div');
  stepAnnouncer.className = 'sr-only';
  stepAnnouncer.dataset.buyerStepAnnouncer = 'true';
  stepAnnouncer.setAttribute('role', 'status');
  stepAnnouncer.setAttribute('aria-live', 'polite');
  stepAnnouncer.setAttribute('aria-atomic', 'true');
  form.insertBefore(stepAnnouncer, form.firstChild);
  if (status) status.setAttribute('aria-atomic', 'true');

  function field(name) {
    return form.elements && form.elements[name] ? form.elements[name] : null;
  }

  function setField(name, value) {
    var input = field(name);
    if (input) input.value = value || '';
  }

  function pushEvent(eventName, extra) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({
      event: eventName,
      campaign_id: context.campaignId,
      partner_id: context.partnerId,
      referral_source: context.referralSource,
      entry: 'buyer_lander'
    }, extra || {}));
  }

  function applyContext() {
    setField('campaign', context.campaignId);
    setField('campaign_id', context.campaignId);
    setField('partner_id', context.partnerId);
    setField('partner_name', context.partnerName);
    setField('partner_code', context.partnerCode);
    setField('referral_source', context.referralSource);
    setField('utm_source', context.utmSource);
    setField('utm_medium', context.utmMedium);
    setField('utm_campaign', context.utmCampaign);
    setField('utm_content', context.utmContent);
    setField('utm_term', context.utmTerm);

    textLinks.forEach(function (link) {
      link.href = module.buildSmsHref(context);
      link.addEventListener('click', function () {
        pushEvent('buyer_text_click', { location: link.dataset.buyerTextLocation || 'buyer_page' });
      });
    });

    if (context.partnerName && referralBanner && referralName) {
      referralName.textContent = context.partnerName;
      referralBanner.hidden = false;
    }
  }

  function localDateString(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function configureClosingDate() {
    var closingDate = field('closing_date');
    if (!closingDate) return;
    closingDate.min = localDateString(new Date());
    closingDate.addEventListener('change', updateClosingUrgency);
  }

  function updateClosingUrgency() {
    var closingDate = field('closing_date');
    var urgency = field('closing_urgency');
    var note = document.querySelector('[data-closing-note]');
    var value = closingDate ? closingDate.value : '';
    var level = 'not_set';

    if (value) {
      var selected = new Date(value + 'T12:00:00');
      var today = new Date();
      today.setHours(12, 0, 0, 0);
      var days = Math.ceil((selected.getTime() - today.getTime()) / 86400000);
      if (days <= 7) level = 'within_7_days';
      else if (days <= 14) level = 'within_14_days';
      else if (days <= 30) level = 'within_30_days';
      else level = 'over_30_days';
    }

    if (urgency) urgency.value = level;
    if (note) {
      note.textContent = level === 'within_7_days'
        ? 'Closing soon. Dylan will receive the date with your request.'
        : 'An estimated date is helpful, but you can leave it blank if it is not set.';
      note.dataset.urgent = level === 'within_7_days' ? 'true' : 'false';
    }
  }

  function validateStep(step) {
    var controls = Array.from(step.querySelectorAll('input, select, textarea'));
    for (var i = 0; i < controls.length; i += 1) {
      if (!controls[i].checkValidity()) {
        controls[i].setAttribute('aria-invalid', 'true');
        if (status && status.id) {
          var values = (controls[i].getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
          if (values.indexOf(status.id) === -1) values.push(status.id);
          controls[i].setAttribute('aria-describedby', values.join(' '));
          status.textContent = 'Please complete the highlighted field to continue.';
        }
        controls[i].reportValidity();
        controls[i].focus();
        return false;
      }
    }
    return true;
  }

  function showStep(index, focus) {
    currentStep = Math.max(0, Math.min(index, steps.length - 1));
    steps.forEach(function (step, stepIndex) {
      var active = stepIndex === currentStep;
      step.hidden = !active;
      step.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    progressItems.forEach(function (item, itemIndex) {
      item.dataset.state = itemIndex < currentStep ? 'complete' : itemIndex === currentStep ? 'active' : 'upcoming';
      if (itemIndex === currentStep) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    var legend = steps[currentStep].querySelector('legend');
    stepAnnouncer.textContent = 'Step ' + (currentStep + 1) + ' of ' + steps.length + ': ' + (legend ? legend.textContent : 'Buyer coverage review');
    if (status) status.textContent = '';
    if (focus) {
      var firstControl = steps[currentStep].querySelector('input:not([type="hidden"]), select, button');
      if (firstControl) {
        try { firstControl.focus({ preventScroll: true }); } catch (_) { firstControl.focus(); }
      }
    }
    pushEvent('buyer_form_step_view', { step: currentStep + 1 });
  }

  function scrollForm() {
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    form.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  function clearControlValidation(event) {
    var control = event.target;
    if (!control || !control.matches('input, select, textarea') || !control.checkValidity()) return;
    control.removeAttribute('aria-invalid');
    if (status && status.id) {
      var values = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (value) {
        return value !== status.id;
      });
      if (values.length) control.setAttribute('aria-describedby', values.join(' '));
      else control.removeAttribute('aria-describedby');
      status.textContent = '';
    }
  }

  form.addEventListener('input', clearControlValidation);
  form.addEventListener('change', clearControlValidation);

  form.addEventListener('click', function (event) {
    var next = event.target.closest('[data-buyer-next]');
    var back = event.target.closest('[data-buyer-back]');
    if (next) {
      event.preventDefault();
      if (!validateStep(steps[currentStep])) return;
      showStep(currentStep + 1, true);
      scrollForm();
    }
    if (back) {
      event.preventDefault();
      showStep(currentStep - 1, true);
      scrollForm();
    }
  });

  form.addEventListener('submit', function () {
    updateClosingUrgency();
    pushEvent('buyer_form_submit', {
      closing_urgency: field('closing_urgency') ? field('closing_urgency').value : '',
      occupancy: field('occupancy') ? field('occupancy').value : ''
    });
  }, { capture: true });

  Array.from(document.querySelectorAll('[data-buyer-start-online]')).forEach(function (link) {
    link.addEventListener('click', function () {
      pushEvent('buyer_start_online_click');
      window.setTimeout(function () {
        var propertyInput = field('property_address');
        if (propertyInput) propertyInput.focus({ preventScroll: true });
      }, 500);
    });
  });

  applyContext();
  configureClosingDate();
  updateClosingUrgency();
  showStep(0, false);
  pushEvent('buyer_entry_view');
})(window, document);
