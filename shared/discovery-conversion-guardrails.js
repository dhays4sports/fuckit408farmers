(function (window, document) {
  'use strict';

  var BUILD = '408-DISCOVERY-1.1';
  var ALLOWED_REQUIRED_FIELDS = Object.freeze(['first_name', 'phone', 'consent']);

  function audit() {
    var form = document.querySelector('form[data-discovery-conversion-build="' + BUILD + '"]');
    if (!form) return Object.freeze({ build: BUILD, applicable: false, valid: true, errors: [] });

    var errors = [];
    var questions = document.querySelectorAll('[data-home-engagement] [data-home-step]');
    var declaredQuestionCount = Number(form.dataset.precheckpointQuestionCount || 0);
    var requiredFields = Array.prototype.slice.call(form.querySelectorAll('[required][name]')).map(function (field) { return field.name; });
    var unexpectedRequiredFields = requiredFields.filter(function (name) { return ALLOWED_REQUIRED_FIELDS.indexOf(name) === -1; });
    var skip = form.querySelector('[data-continue-without-saving]');
    var payoff = document.querySelector('[data-home-payoff]');

    if (declaredQuestionCount !== 3 || questions.length !== 3) errors.push('precheckpoint_question_count');
    if (unexpectedRequiredFields.length) errors.push('checkpoint_field_scope');
    if (!ALLOWED_REQUIRED_FIELDS.every(function (name) { return requiredFields.indexOf(name) !== -1; })) errors.push('checkpoint_minimum_fields');
    if (!skip || form.dataset.anonymousContinuation !== 'true') errors.push('anonymous_continuation');
    if (!payoff || form.dataset.snapshotBeforeRefinement !== 'true') errors.push('snapshot_first');

    var result = Object.freeze({
      build: BUILD,
      applicable: true,
      valid: errors.length === 0,
      errors: Object.freeze(errors.slice()),
      precheckpointQuestionCount: questions.length,
      requiredFields: Object.freeze(requiredFields.slice()),
      anonymousContinuation: Boolean(skip),
      visualRedesignIntroduced: false
    });
    form.dataset.discoveryConversionGuardrails = result.valid ? 'pass' : 'fail';
    return result;
  }

  var result = null;
  function install() { result = audit(); return result; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  window.DiscoveryConversionGuardrails = Object.freeze({
    BUILD: BUILD,
    ALLOWED_REQUIRED_FIELDS: ALLOWED_REQUIRED_FIELDS,
    audit: audit,
    getResult: function () { return result; }
  });
})(window, document);
