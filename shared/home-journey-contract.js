(function (root, factory) {
  'use strict';
  var api = factory();
  root.HomeJourneyContract = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var VERSION = '2.0';
  var BUILD = '408-DISCOVERY-1.0';
  var CONTRACT = 'home-review-journey-v1';

  var STAGES = Object.freeze({
    LANDING: 'landing',
    ENGAGEMENT: 'engagement',
    PAYOFF: 'personalized_payoff',
    LEAD_CAPTURE: 'lead_capture',
    CONFIRMATION: 'confirmation',
    COVERAGEFIT_HANDOFF: 'coveragefit_handoff',
    ASSESSMENT: 'assessment',
    COMPLETION: 'completion'
  });

  var EVENTS = Object.freeze({
    JOURNEY_VIEWED: 'home_journey_viewed',
    CAMPAIGN_MATCHED: 'home_campaign_matched',
    QR_ROUTE_RESOLVED: 'home_qr_route_resolved',
    JOURNEY_RESUMED: 'home_journey_resumed',
    JOURNEY_RESTARTED: 'home_journey_restarted',
    JOURNEY_EXPIRED: 'home_journey_expired',
    BRANCH_RESOLVED: 'home_branch_resolved',
    HANDOFF_RECOVERY_VIEWED: 'home_handoff_recovery_viewed',
    HANDOFF_RECOVERY_CONTINUED: 'home_handoff_recovery_continued',
    PRIMARY_CTA_SELECTED: 'home_primary_cta_selected',
    ENGAGEMENT_STARTED: 'home_engagement_started',
    ENGAGEMENT_STEP_VIEWED: 'home_engagement_step_viewed',
    ENGAGEMENT_STEP_COMPLETED: 'home_engagement_step_completed',
    ENGAGEMENT_COMPLETED: 'home_engagement_completed',
    PAYOFF_VIEWED: 'home_personalized_payoff_viewed',
    PAYOFF_CONTINUED: 'home_personalized_payoff_continued',
    PAYOFF_EDIT_SELECTED: 'home_personalized_payoff_edit_selected',
    LEAD_CAPTURE_PRESENTED: 'home_lead_capture_presented',
    LEAD_CAPTURE_STEP_VIEWED: 'home_lead_capture_step_viewed',
    LEAD_CAPTURE_STEP_COMPLETED: 'home_lead_capture_step_completed',
    LEAD_CAPTURE_BACK_SELECTED: 'home_lead_capture_back_selected',
    LEAD_FORM_STARTED: 'home_lead_form_started',
    LEAD_SUBMISSION_ATTEMPTED: 'home_lead_submission_attempted',
    LEAD_SUBMISSION_CONFIRMED: 'home_lead_submission_confirmed',
    LEAD_SUBMISSION_PENDING: 'home_lead_submission_pending',
    LEAD_SUBMISSION_UNCONFIRMED: 'home_lead_submission_unconfirmed',
    CONFIRMATION_VIEWED: 'home_confirmation_viewed',
    CONFIRMATION_CONTINUED: 'home_confirmation_continued',
    COVERAGEFIT_LAUNCHED: 'home_coveragefit_launched',
    ASSESSMENT_STARTED: 'home_assessment_started',
    ASSESSMENT_COMPLETED: 'home_assessment_completed'
  });

  var SEMANTIC_FIELDS = Object.freeze({
    home_review_goal: Object.freeze(['farmers_fit', 'coverage_fit', 'home_auto_bundle', 'exploring']),
    housing_context: Object.freeze(['owner_occupied', 'landlord', 'buyer', 'renter']),
    review_timing: Object.freeze(['shopping_now', 'renewal_60', 'later', 'coordination', 'price_only', 'not_sure'])
  });

  function clean(value, max) {
    return String(value === undefined || value === null ? '' : value)
      .trim()
      .replace(/[^a-z0-9_-]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase()
      .slice(0, max || 80);
  }

  function allowed(fieldName, value) {
    var normalized = clean(value);
    var values = SEMANTIC_FIELDS[fieldName] || [];
    return values.indexOf(normalized) !== -1 ? normalized : '';
  }

  function semanticContext(input) {
    var source = input && typeof input === 'object' ? input : {};
    return Object.freeze({
      homeReviewGoal: allowed('home_review_goal', source.homeReviewGoal || source.home_review_goal),
      housingContext: allowed('housing_context', source.housingContext || source.housing_context),
      reviewTiming: allowed('review_timing', source.reviewTiming || source.review_timing)
    });
  }

  function deriveReviewContext(input, fallback) {
    var context = semanticContext(input);
    if (context.housingContext === 'buyer') return 'Buying a home';
    if (context.housingContext === 'renter') return 'Need a new policy';
    if (context.housingContext === 'landlord') return 'Comparing coverage';
    if (context.reviewTiming === 'renewal_60') return 'Current policy renewal';
    if (context.homeReviewGoal === 'home_auto_bundle') return 'Home and auto together';
    if (context.reviewTiming === 'shopping_now') return 'Comparing coverage';
    if (context.homeReviewGoal === 'farmers_fit' || context.homeReviewGoal === 'coverage_fit') return 'Comparing coverage';
    if (context.homeReviewGoal === 'exploring') return 'Other';
    return String(fallback || '').trim();
  }

  function fromForm(form) {
    function value(name) {
      return form && form.elements && form.elements[name] ? form.elements[name].value : '';
    }
    return semanticContext({
      home_review_goal: value('home_review_goal'),
      housing_context: value('housing_context'),
      review_timing: value('review_timing')
    });
  }

  function hasSemanticContext(input) {
    var context = semanticContext(input);
    return Boolean(context.homeReviewGoal || context.housingContext || context.reviewTiming);
  }

  return Object.freeze({
    VERSION: VERSION,
    BUILD: BUILD,
    CONTRACT: CONTRACT,
    STAGES: STAGES,
    EVENTS: EVENTS,
    SEMANTIC_FIELDS: SEMANTIC_FIELDS,
    allowed: allowed,
    semanticContext: semanticContext,
    deriveReviewContext: deriveReviewContext,
    fromForm: fromForm,
    hasSemanticContext: hasSemanticContext
  });
});
