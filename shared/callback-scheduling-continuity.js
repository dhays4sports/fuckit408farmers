/* 408-CALLBACK-1.1 — explicit exact-time, anytime, or no-contact browser continuation. */
(function (window, document) {
  'use strict';
  var BUILD = '408-CALLBACK-1.1';
  var SCHEMA = '408-callback-browser-booking-v1';
  var ENDPOINT = '/api/callback/schedule';
  var mounted = new WeakSet();

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') return '';
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    var hex = Array.prototype.map.call(bytes, function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
    return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
  }
  function text(value, max) { return String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 160); }
  function phone(value) {
    var digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 10) digits = '1' + digits;
    return digits.length === 11 && digits.charAt(0) === '1' ? '+' + digits : '';
  }
  function product(value) {
    var normalized = text(value, 40).toLowerCase();
    if (normalized.indexOf('life') >= 0) return 'life';
    if (normalized.indexOf('auto') >= 0) return 'auto';
    if (normalized.indexOf('business') >= 0 || normalized.indexOf('commercial') >= 0) return 'business';
    if (normalized.indexOf('home') >= 0 || normalized.indexOf('buyer') >= 0 || normalized.indexOf('tech') >= 0 || normalized.indexOf('teacher') >= 0 || normalized.indexOf('health') >= 0 || normalized.indexOf('engineer') >= 0) return 'home';
    return 'general';
  }
  function field(form, names) {
    if (!form) return '';
    for (var i = 0; i < names.length; i += 1) {
      var control = form.elements && form.elements[names[i]];
      if (control && text(control.value, 200)) return text(control.value, 200);
    }
    return '';
  }
  function isoDate(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function weekend(value) {
    var parts = String(value || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(function (part) { return !Number.isInteger(part); })) return false;
    var day = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
    return day === 0 || day === 6;
  }
  function timeOptions() {
    var options = ['<option value="">Choose a time</option>'];
    for (var hour = 9; hour <= 17; hour += 1) {
      for (var minute = 0; minute < 60; minute += 30) {
        var value = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
        var displayHour = hour > 12 ? hour - 12 : hour;
        options.push('<option value="' + value + '">' + displayHour + ':' + String(minute).padStart(2, '0') + (hour >= 12 ? ' PM' : ' AM') + '</option>');
      }
    }
    return options.join('');
  }
  function safeCalendarUrl(value) {
    try {
      var url = new URL(String(value || ''));
      var allowed = ['https://coveragefit.com', 'https://www.coveragefit.com', 'https://review.408farmers.com'];
      return allowed.indexOf(url.origin) >= 0 && url.pathname === '/appointment/' && /^\?token=[A-Za-z0-9_-]{24,96}$/.test(url.search) ? url.toString() : '';
    } catch (_) { return ''; }
  }
  function emit(name, detail) {
    var safe = Object.assign({ event:name, callback_build:BUILD }, detail || {});
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(safe);
    try { document.dispatchEvent(new window.CustomEvent('408farmers:' + name, { detail:safe })); } catch (_) {}
  }

  function mount(target, options) {
    if (!target || mounted.has(target)) return false;
    mounted.add(target);
    var settings = options || {};
    var form = settings.form || null;
    var knownPhone = phone(settings.phone || field(form, ['phone','mobile']));
    var firstName = text(settings.firstName || field(form, ['first_name','firstName']), 60);
    var requestId = uuid();
    var correlationId = text(settings.correlationId || field(form, ['lead_checkpoint_id']) || window.ProspectProfileBuilder?.leadCheckpointId?.(), 120);
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(correlationId)) correlationId = '408d_' + correlationId.replace(/-/g, '').toLowerCase();
    var productType = product(settings.productType || (form && form.dataset ? form.dataset.cfEntry : '') || window.location.pathname);
    var route = text(settings.sourceRoute || window.location.pathname, 80);
    var today = new Date();
    var maximum = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 60);

    target.hidden = false;
    target.classList.add('callback-continuity');
    target.setAttribute('aria-labelledby', 'callbackContinuityTitle-' + requestId);
    target.innerHTML = [
      '<div class="callback-continuity__eyebrow">Your choice</div>',
      '<h3 id="callbackContinuityTitle-' + requestId + '">How should Dylan follow up?</h3>',
      '<p>Choose an exact time, ask Dylan to call when he is available, or leave it here for now.</p>',
      '<div class="callback-continuity__choices" data-callback-choices>',
        '<button class="callback-continuity__primary" type="button" data-callback-choose-time>Choose a callback time</button>',
        '<button class="callback-continuity__anytime" type="button" data-callback-anytime>Call me when available</button>',
        '<button class="callback-continuity__later" type="button" data-callback-later>No contact right now</button>',
      '</div>',
      '<div data-callback-schedule hidden>',
      '<div class="callback-continuity__fields">',
        '<label>Date<input type="date" data-callback-date min="' + isoDate(today) + '" max="' + isoDate(maximum) + '"></label>',
        '<label>Time<select data-callback-time aria-describedby="callbackContinuityTimeZone-' + requestId + '">' + timeOptions() + '</select></label>',
      '</div>',
      '<p class="callback-continuity__time-zone" id="callbackContinuityTimeZone-' + requestId + '">Times are shown in Pacific Time.</p>',
      '<div class="callback-continuity__phone" data-callback-phone-wrap' + (knownPhone ? ' hidden' : '') + '>',
        '<label>Mobile number<input type="tel" inputmode="tel" autocomplete="tel" maxlength="24" data-callback-phone></label>',
      '</div>',
      '<button class="callback-continuity__primary" type="button" data-callback-start>Confirm callback</button>',
      '<button class="callback-continuity__later" type="button" data-callback-cancel-time>Back to choices</button>',
      '</div>',
      '<p class="callback-continuity__consent">By confirming, you ask Dylan to call you at this number at the selected time. This does not enroll you in marketing texts.</p>',
      '<div class="callback-continuity__alternatives" data-callback-alternatives hidden></div>',
      '<p class="callback-continuity__status" data-callback-status role="status" aria-live="polite"></p>'
    ].join('');

    var dateInput = target.querySelector('[data-callback-date]');
    var timeInput = target.querySelector('[data-callback-time]');
    var input = target.querySelector('[data-callback-phone]');
    var phoneWrap = target.querySelector('[data-callback-phone-wrap]');
    var choices = target.querySelector('[data-callback-choices]');
    var schedule = target.querySelector('[data-callback-schedule]');
    var chooseTime = target.querySelector('[data-callback-choose-time]');
    var anytime = target.querySelector('[data-callback-anytime]');
    var start = target.querySelector('[data-callback-start]');
    var later = target.querySelector('[data-callback-later]');
    var cancelTime = target.querySelector('[data-callback-cancel-time]');
    var status = target.querySelector('[data-callback-status]');
    var alternatives = target.querySelector('[data-callback-alternatives]');

    function resetAttempt() { requestId = uuid(); alternatives.hidden = true; alternatives.innerHTML = ''; }
    dateInput.addEventListener('change', resetAttempt);
    timeInput.addEventListener('change', resetAttempt);
    chooseTime.addEventListener('click', function () {
      choices.hidden = true;
      schedule.hidden = false;
      dateInput.focus();
      emit('callback_time_choice_opened', { product_type:productType, source_route:route });
    });
    cancelTime.addEventListener('click', function () {
      schedule.hidden = true;
      choices.hidden = false;
      status.textContent = '';
      chooseTime.focus();
    });
    later.addEventListener('click', function () {
      chooseTime.disabled = true;
      anytime.disabled = true;
      later.disabled = true;
      status.textContent = 'No contact requested. You can return whenever you are ready.';
      emit('callback_contact_declined', { product_type:productType, source_route:route });
    });
    anytime.addEventListener('click', async function () {
      var mobile = knownPhone || phone(input && input.value);
      if (!mobile) {
        phoneWrap.hidden = false;
        status.textContent = 'Add the number Dylan should call.';
        if (input) input.focus();
        return;
      }
      anytime.disabled = true; chooseTime.disabled = true; later.disabled = true;
      status.textContent = 'Saving your callback request…';
      var requestedAt = new Date().toISOString();
      var fields = new FormData();
      fields.set('lead_checkpoint_id', correlationId);
      fields.set('lead_stage', 'contact_requested');
      fields.set('first_name', firstName);
      fields.set('phone', mobile);
      fields.set('contact_basis', 'customer_requested_callback_anytime');
      fields.set('contact_basis_version', '408farmers-callback-anytime-v1');
      fields.set('contact_basis_timestamp', requestedAt);
      fields.set('contact_consent_state', 'granted');
      fields.set('contact_consent_version', '408farmers-callback-anytime-v1');
      fields.set('contact_consent_timestamp', requestedAt);
      fields.set('automated_marketing_sms_consent_state', 'not_granted');
      fields.set('review_track', productType);
      fields.set('source_key', 'web_408_callback_anytime');
      fields.set('source', route);
      fields.set('landing_page', window.location.origin + window.location.pathname);
      fields.set('submitted_at', requestedAt);
      try {
        var response = await window.fetch('/api/lead', { method:'POST', body:fields, credentials:'same-origin', headers:{ Accept:'application/json' } });
        var result = await response.json().catch(function () { return {}; });
        if (!response.ok || result.ok !== true) throw new Error('Your request could not be confirmed.');
        status.textContent = 'Request confirmed. Dylan will call when he is available.';
        emit('callback_anytime_confirmed', { product_type:productType, source_route:route, result:'confirmed' });
      } catch (cause) {
        anytime.disabled = false; chooseTime.disabled = false; later.disabled = false;
        status.textContent = (cause && cause.message) || 'Your request could not be confirmed. Please try again.';
        emit('callback_anytime_failed', { product_type:productType, source_route:route, result:'failed' });
      }
    });
    alternatives.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-date][data-time]');
      if (!button) return;
      dateInput.value = button.dataset.date;
      timeInput.value = button.dataset.time;
      resetAttempt();
      status.textContent = 'That available time is selected. Confirm it when you’re ready.';
      start.focus();
    });

    start.addEventListener('click', async function () {
      var mobile = knownPhone || phone(input && input.value);
      if (!dateInput.value || !timeInput.value) {
        status.textContent = 'Choose a date and time.';
        (!dateInput.value ? dateInput : timeInput).focus();
        return;
      }
      if (weekend(dateInput.value)) {
        status.textContent = 'Choose a Monday through Friday.';
        dateInput.focus();
        return;
      }
      if (!mobile) {
        phoneWrap.hidden = false;
        status.textContent = 'Add the number Dylan should call.';
        if (input) input.focus();
        return;
      }
      if (!requestId) requestId = uuid();
      start.disabled = true;
      cancelTime.disabled = true;
      status.textContent = 'Checking Dylan’s calendar…';
      try {
        var response = await window.fetch(ENDPOINT, {
          method:'POST', credentials:'same-origin', cache:'no-store', redirect:'error',
          headers:{ 'Accept':'application/json', 'Content-Type':'application/json', 'X-408-Callback-Version':'1' },
          body:JSON.stringify({
            schema_version:SCHEMA, request_id:requestId, correlation_id:correlationId,
            first_name:firstName, phone:mobile, product_type:productType, source_route:route,
            date:dateInput.value, time:timeInput.value, call_request:true,
            call_request_version:SCHEMA, call_request_timestamp:new Date().toISOString()
          })
        });
        var result = await response.json().catch(function () { return {}; });
        if (!response.ok || result.ok !== true) throw new Error(result && result.error ? text(result.error, 180) : 'The callback time could not be confirmed.');
        if (result.booked !== true || result.available === false) {
          start.disabled = false;
          cancelTime.disabled = false;
          status.textContent = 'That time is no longer available. Choose another time below.';
          alternatives.replaceChildren();
          (result.alternatives || []).slice(0, 2).forEach(function (slot) {
            var date = text(slot && slot.date, 10);
            var time = text(slot && slot.time, 5);
            if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return;
            var choice = document.createElement('button');
            choice.type = 'button';
            choice.dataset.date = date;
            choice.dataset.time = time;
            choice.textContent = text(slot.display, 100) || 'Choose this available time';
            alternatives.appendChild(choice);
          });
          alternatives.hidden = !alternatives.childElementCount;
          requestId = uuid();
          emit('callback_booking_unavailable', { product_type:productType, source_route:route, result:'unavailable' });
          return;
        }
        var calendarUrl = safeCalendarUrl(result.appointment && result.appointment.calendarUrl);
        if (!calendarUrl) throw new Error('The callback was booked, but the calendar page could not be opened. Your appointment remains confirmed.');
        status.textContent = 'Confirmed. Opening your calendar page…';
        emit('callback_booking_confirmed', { product_type:productType, source_route:route, result:'confirmed' });
        window.location.assign(calendarUrl);
      } catch (cause) {
        start.disabled = false;
        cancelTime.disabled = false;
        status.textContent = (cause && cause.message) || 'The callback time could not be confirmed. Please try again.';
        emit('callback_booking_failed', { product_type:productType, source_route:route, result:'failed' });
      }
    });

    emit('callback_booking_prompt_viewed', { product_type:productType, source_route:route });
    return true;
  }

  window.CallbackSchedulingContinuity = Object.freeze({ BUILD:BUILD, mount:mount });
})(window, document);
