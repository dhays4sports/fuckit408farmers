/* 408-LOCAL-1.5 — Merchant Join Flow */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.LocalMerchantJoin = api;
    if (root.document) root.document.addEventListener('DOMContentLoaded', () => api.mount(root.document, root.location));
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const BUILD = '408-LOCAL-1.5';
  const UTM_FIELDS = Object.freeze(['utm_source','utm_medium','utm_campaign','utm_content','utm_term']);
  const REQUIRED_FIELDS = Object.freeze(['business_name','category','business_location','contact_name','email','phone','proposed_perk','authorized_ack','separation_ack']);

  function text(value, max) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max || 1200);
  }

  function populateContext(form, locationLike) {
    if (!form) return;
    const location = locationLike || (typeof window !== 'undefined' ? window.location : null);
    const params = new URLSearchParams((location && location.search) || '');
    UTM_FIELDS.forEach((name) => {
      const field = form.elements.namedItem(name);
      if (field) field.value = text(params.get(name), name === 'utm_term' ? 160 : 120);
    });
    const landing = form.elements.namedItem('landing_page');
    if (landing && location) landing.value = text(location.href || '', 500);
  }

  function stampSubmission(form, now) {
    const field = form && form.elements.namedItem('submitted_at');
    if (field) field.value = (now instanceof Date ? now : new Date(now || Date.now())).toISOString();
  }

  function requiredValues(formData) {
    return REQUIRED_FIELDS.every((name) => text(formData.get(name), 1200));
  }

  function validateFormData(formData) {
    if (!formData || !requiredValues(formData)) return { ok: false, error: 'Please complete the required fields.' };
    if (text(formData.get('_gotcha'), 80)) return { ok: false, error: 'Unable to submit this application.' };
    const email = text(formData.get('email'), 160);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' };
    const phoneDigits = text(formData.get('phone'), 30).replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15) return { ok: false, error: 'Enter a valid phone number.' };
    const category = text(formData.get('category'), 30);
    if (!['eat-drink','home','auto','other'].includes(category)) return { ok: false, error: 'Choose a business category.' };
    if (formData.get('authorized_ack') !== 'yes' || formData.get('separation_ack') !== 'yes') return { ok: false, error: 'Please confirm both acknowledgments.' };
    return { ok: true };
  }

  function setStatus(statusEl, message, kind) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.dataset.state = kind || '';
  }

  function setBusy(form, busy) {
    const button = form && form.querySelector('[data-local-join-submit]');
    if (!button) return;
    button.disabled = Boolean(busy);
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
    button.textContent = busy ? 'Sending application…' : 'Apply to Join 408FARMERS Local';
  }

  function focusFirstInvalid(form) {
    if (!form) return;
    const invalid = form.querySelector(':invalid');
    if (invalid && typeof invalid.focus === 'function') invalid.focus();
  }

  async function submitViaProxy(form, fetchImpl) {
    const endpoint = form.dataset.proxyEndpoint || '/api/local/merchant-application';
    const fetcher = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (!fetcher) return { ok: false, fallback: true, status: 0 };
    const response = await fetcher(endpoint, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });
    if (response.ok) return { ok: true, status: response.status };
    return { ok: false, fallback: response.status >= 500, status: response.status };
  }

  function nativeFallback(form) {
    if (!form) return;
    const nativeSubmit = typeof HTMLFormElement !== 'undefined' && HTMLFormElement.prototype && HTMLFormElement.prototype.submit;
    if (nativeSubmit) nativeSubmit.call(form);
    else if (typeof form.submit === 'function') form.submit();
  }

  function mount(doc, locationLike) {
    const form = doc && doc.querySelector('[data-local-merchant-join]');
    if (!form || form.dataset.localJoinMounted === 'true') return false;
    form.dataset.localJoinMounted = 'true';
    populateContext(form, locationLike);
    const status = form.querySelector('[data-local-join-status]');

    form.addEventListener('submit', async (event) => {
      stampSubmission(form);
      if (!form.checkValidity()) {
        event.preventDefault();
        form.reportValidity();
        focusFirstInvalid(form);
        setStatus(status, 'Please complete the required fields before submitting.', 'error');
        return;
      }

      const validation = validateFormData(new FormData(form));
      if (!validation.ok) {
        event.preventDefault();
        setStatus(status, validation.error, 'error');
        return;
      }

      event.preventDefault();
      setBusy(form, true);
      setStatus(status, 'Sending your application securely…', 'working');
      try {
        const result = await submitViaProxy(form);
        if (result.ok) {
          setStatus(status, 'Application received. Redirecting…', 'success');
          const success = form.dataset.success || '/local/join/thank-you.html';
          if (typeof window !== 'undefined' && window.location) window.location.assign(success);
          return;
        }
        if (result.fallback) {
          setStatus(status, 'Using the backup delivery path…', 'working');
          nativeFallback(form);
          return;
        }
        setBusy(form, false);
        setStatus(status, 'Please review the form and try again.', 'error');
      } catch (_) {
        setStatus(status, 'Using the backup delivery path…', 'working');
        nativeFallback(form);
      }
    });
    return true;
  }

  return Object.freeze({ BUILD, UTM_FIELDS, REQUIRED_FIELDS, populateContext, stampSubmission, validateFormData, submitViaProxy, mount });
});
