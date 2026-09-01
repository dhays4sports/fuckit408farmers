(function (window, document) {
  'use strict';

  var BUILD = '408-HOME-2.9';
  var form = document.querySelector('form[data-home-journey="true"]');
  var engagement = document.querySelector('[data-home-engagement]');
  var engagementProgress = engagement?.querySelector('[role="progressbar"]') || null;
  var leadProgress = form?.querySelector('[data-home-lead-progress] [role="progressbar"]') || null;
  var formStatus = document.getElementById('formStatus');

  function appendToken(value, token) {
    var tokens = String(value || '').split(/\s+/).filter(Boolean);
    if (tokens.indexOf(token) === -1) tokens.push(token);
    return tokens.join(' ');
  }

  function removeToken(value, token) {
    return String(value || '').split(/\s+/).filter(function (item) { return item && item !== token; }).join(' ');
  }

  function syncProgress(progress, current) {
    if (!progress) return;
    progress.setAttribute('aria-valuenow', String(current));
    progress.setAttribute('aria-valuetext', current + ' of ' + progress.getAttribute('aria-valuemax'));
  }

  document.addEventListener('408farmers:home-certification-progress', function (event) {
    var detail = event.detail || {};
    if (detail.kind === 'engagement') syncProgress(engagementProgress, detail.current);
    if (detail.kind === 'lead') syncProgress(leadProgress, detail.current);
  });

  if (form && formStatus) {
    form.addEventListener('invalid', function (event) {
      var field = event.target;
      if (!field || typeof field.setAttribute !== 'function') return;
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', appendToken(field.getAttribute('aria-describedby'), formStatus.id));
    }, true);

    ['input', 'change'].forEach(function (name) {
      form.addEventListener(name, function (event) {
        var field = event.target;
        if (!field || typeof field.checkValidity !== 'function' || !field.checkValidity()) return;
        field.removeAttribute('aria-invalid');
        var describedBy = removeToken(field.getAttribute('aria-describedby'), formStatus.id);
        if (describedBy) field.setAttribute('aria-describedby', describedBy);
        else field.removeAttribute('aria-describedby');
      });
    });
  }

  window.HomeMobileAccessibilityCertification = Object.freeze({
    BUILD: BUILD,
    viewportFloor: 320,
    touchTargetFloor: 44,
    initialTransferBudgetBytes: 500000
  });
})(window, document);
