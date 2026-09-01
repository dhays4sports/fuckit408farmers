(() => {
  'use strict';

  const VERSION = '1.4';
  const TRANSITION_STORAGE_KEY = 'coveragefit_transition_v1';
  const PROFILE_STORAGE_KEY = 'coveragefit_prospect_profile_v1';
  const WELCOME_STORAGE_KEY = 'coveragefit_transition_welcome_v1';
  const FALLBACK_DESTINATION = '/home/';
  const STEP_INTERVAL = 360;
  const FINAL_STEP_AT = STEP_INTERVAL * 4;
  const DEFAULT_DELAY = 2000;
  const REDUCED_MOTION_DELAY = 350;
  const EXIT_DELAY = 160;

  const PERSONALIZATIONS = Object.freeze({
    general: Object.freeze({
      title: 'Preparing Your CoverageFit Review',
      kicker: 'Personalized Coverage Review',
      heading: 'Preparing your CoverageFit experience',
      message: 'Your information is secure. We’re preparing your personalized CoverageFit experience.',
      steps: Object.freeze([
        'Contact information secured',
        'Home located',
        'Identifying protection priorities',
        'Building your personalized review'
      ]),
      finalKicker: 'Almost Ready…',
      finalMessage: 'Preparing your Home Protection Dashboard'
    }),
    homebuyer: Object.freeze({
      title: 'Preparing Your New Home Review | CoverageFit',
      kicker: 'New Home Coverage Review',
      heading: 'Preparing your new home coverage review',
      message: 'We’re organizing the protection details that matter most before you compare options for your new home.',
      steps: Object.freeze([
        'Your information is secured',
        'New home details located',
        'Identifying purchase protection priorities',
        'Building your new home review'
      ]),
      finalKicker: 'Almost Ready…',
      finalMessage: 'Preparing your New Home Protection Dashboard'
    }),
    renewal: Object.freeze({
      title: 'Preparing Your Annual Coverage Review | CoverageFit',
      kicker: 'Annual Coverage Review',
      heading: 'Preparing your annual coverage review',
      message: 'We’re organizing your protection details so you can review what still fits before your renewal decision.',
      steps: Object.freeze([
        'Contact information secured',
        'Current home located',
        'Reviewing renewal priorities',
        'Building your annual coverage review'
      ]),
      finalKicker: 'Almost Ready…',
      finalMessage: 'Preparing your Annual Protection Dashboard'
    }),
    'non-renewal': Object.freeze({
      title: 'Preparing Your Coverage Review | CoverageFit',
      kicker: 'Coverage Continuity Review',
      heading: 'Preparing your coverage review',
      message: 'We’re organizing your information and the protection priorities worth understanding as you consider your next coverage options.',
      steps: Object.freeze([
        'Contact information secured',
        'Home located',
        'Identifying coverage continuity priorities',
        'Building your coverage review'
      ]),
      finalKicker: 'Almost Ready…',
      finalMessage: 'Preparing your Coverage Review Dashboard'
    }),
    'premium-increase': Object.freeze({
      title: 'Preparing Your Personalized Review | CoverageFit',
      kicker: 'Premium Increase Review',
      heading: 'Preparing your personalized coverage review',
      message: 'We’re organizing your protection details so you can review coverage before making changes based on price alone.',
      steps: Object.freeze([
        'Contact information secured',
        'Home located',
        'Reviewing protection before price',
        'Building your personalized review'
      ]),
      finalKicker: 'Almost Ready…',
      finalMessage: 'Preparing your Protection Review Dashboard'
    })
  });

  const FALLBACK_STEPS = Object.freeze([
    'CoverageFit opened',
    'Review tools ready',
    'Preparing your starting point',
    'Opening CoverageFit'
  ]);

  const PROPERTY_CONFIRMATIONS = Object.freeze({
    general: Object.freeze({ pending: 'Confirming home', confirmed: 'Home confirmed' }),
    homebuyer: Object.freeze({ pending: 'Confirming new home', confirmed: 'New home confirmed' }),
    renewal: Object.freeze({ pending: 'Confirming current home', confirmed: 'Current home confirmed' }),
    'non-renewal': Object.freeze({ pending: 'Confirming home', confirmed: 'Home confirmed' }),
    'premium-increase': Object.freeze({ pending: 'Confirming home', confirmed: 'Home confirmed' })
  });

  const readJson = (storage, key) => {
    try { return JSON.parse(storage.getItem(key) || 'null'); } catch (_) { return null; }
  };

  const normalizeDestination = (value) => {
    const route = String(value || '').trim();
    if (!route || !route.startsWith('/') || route.startsWith('//')) return FALLBACK_DESTINATION;
    try {
      const parsed = new URL(route, window.location.origin);
      if (parsed.origin !== window.location.origin) return FALLBACK_DESTINATION;
      if (parsed.pathname === '/transition/' || parsed.pathname === '/transition') return FALLBACK_DESTINATION;
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch (_) {
      return FALLBACK_DESTINATION;
    }
  };

  const normalizeContext = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 160);

  const reasonKeyFor = (value) => {
    const context = normalizeContext(value);
    if (!context) return 'general';
    if (/\bnon[\s-]*renew|not\s+(?:being\s+)?renew|coverage\s+(?:is\s+)?ending|carrier\s+(?:is\s+)?leaving|cancel(?:led|ation)?\b/.test(context)) return 'non-renewal';
    if (/\bhomebuyer\b|buying|purchas|new home|closing|escrow/.test(context)) return 'homebuyer';
    if (/premium|rate increase|price increase|cost increase|rates? went up|premium went up/.test(context)) return 'premium-increase';
    if (/renew|annual review/.test(context)) return 'renewal';
    return 'general';
  };

  const cleanDisplayText = (value, max = 220) => String(value || '')
    .trim()
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, max);

  const isUsableAddress = (value) => {
    const address = cleanDisplayText(value);
    if (address.length < 5 || !/[a-z]/i.test(address)) return false;
    if (/^(?:n\/?a|none|unknown|not provided|not available|tbd)$/i.test(address)) return false;
    if (/^\d{5}(?:-\d{4})?$/.test(address)) return false;
    if (/https?:\/\/|@/.test(address)) return false;
    return true;
  };

  const addressForProfile = (value) => {
    if (!value || typeof value !== 'object') return '';
    const direct = cleanDisplayText(value.propertyAddress || value.address?.formattedAddress);
    if (isUsableAddress(direct)) return direct;

    const street = cleanDisplayText(value.address?.street, 160);
    const city = cleanDisplayText(value.address?.city, 100);
    const state = cleanDisplayText(value.address?.state, 40);
    const postalCode = cleanDisplayText(value.address?.postalCode, 20);
    if (!street) return '';
    const locality = [city, state].filter(Boolean).join(', ');
    const assembled = [street, [locality, postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return isUsableAddress(assembled) ? assembled : '';
  };

  let reducedMotion = false;
  try { reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}

  const state = readJson(sessionStorage, TRANSITION_STORAGE_KEY);
  const profile = readJson(sessionStorage, PROFILE_STORAGE_KEY) || readJson(localStorage, PROFILE_STORAGE_KEY);
  const personalizationContext = window.CoverageFitPersonalization?.get?.() || null;
  const hasHandoff = Boolean(state?.hasProfile || (personalizationContext ? personalizationContext.flags?.hasProfile : profile));
  const contextReasonKey = cleanDisplayText(personalizationContext?.journey?.reasonKey, 40);
  const fallbackReasonKey = hasHandoff ? reasonKeyFor(profile?.reviewContext) : 'general';
  const reasonKey = Object.prototype.hasOwnProperty.call(PERSONALIZATIONS, contextReasonKey)
    ? contextReasonKey
    : fallbackReasonKey;
  const personalization = PERSONALIZATIONS[reasonKey] || PERSONALIZATIONS.general;
  const contextAddress = cleanDisplayText(personalizationContext?.property?.displayAddress, 220);
  const propertyAddress = hasHandoff && isUsableAddress(contextAddress)
    ? contextAddress
    : (hasHandoff ? addressForProfile(profile) : '');
  const givenName = cleanDisplayText(personalizationContext?.identity?.givenName, 80);
  const hasPropertyAddress = Boolean(propertyAddress);
  const propertyCopy = PROPERTY_CONFIRMATIONS[reasonKey] || PROPERTY_CONFIRMATIONS.general;
  const destination = normalizeDestination(state?.destination);
  const kicker = document.getElementById('transitionKicker');
  const heading = document.getElementById('transitionHeading');
  const message = document.getElementById('transitionMessage');
  const status = document.getElementById('transitionStatus');
  const continueLink = document.getElementById('transitionContinue');
  const finalMessage = document.getElementById('transitionFinal');
  const finalKicker = document.getElementById('transitionFinalKicker');
  const finalMessageText = document.getElementById('transitionFinalMessage')
    || (finalMessage && typeof finalMessage.querySelector === 'function' ? finalMessage.querySelector('.transition-final-message') : null);
  const propertyCard = document.getElementById('transitionProperty');
  const propertyLabel = document.getElementById('transitionPropertyLabel');
  const propertyAddressText = document.getElementById('transitionPropertyAddress');
  const propertyDetail = document.getElementById('transitionPropertyDetail');
  const stepNodes = typeof document.querySelectorAll === 'function'
    ? Array.from(document.querySelectorAll('[data-transition-step]'))
    : [];
  const stepLabels = Array.from(hasHandoff ? personalization.steps : FALLBACK_STEPS);
  if (hasHandoff) stepLabels[1] = hasPropertyAddress ? propertyCopy.confirmed : 'Preparing home details';
  const scheduledTimers = [];
  let navigationTimer = null;
  let focusFrame = null;
  let completionTimer = null;
  let completed = false;
  let currentStep = 0;

  const setNodeState = (node, value) => {
    if (!node) return;
    if (node.dataset) node.dataset.state = value;
    else if (typeof node.setAttribute === 'function') node.setAttribute('data-state', value);
  };

  const setCurrent = (node, isCurrent) => {
    if (!node) return;
    if (isCurrent && typeof node.setAttribute === 'function') node.setAttribute('aria-current', 'step');
    if (!isCurrent && typeof node.removeAttribute === 'function') node.removeAttribute('aria-current');
  };

  const announce = (value) => {
    if (status) status.textContent = value;
  };

  const applyPersonalization = () => {
    if (!hasHandoff) {
      if (kicker) kicker.textContent = PERSONALIZATIONS.general.kicker;
      if (heading) heading.textContent = PERSONALIZATIONS.general.heading;
      if (message) message.textContent = 'No saved handoff was found. We’re preparing CoverageFit so you can start your review.';
      if (finalKicker) finalKicker.textContent = 'Almost Ready…';
      if (finalMessageText) finalMessageText.textContent = 'Opening CoverageFit';
      if (document) document.title = PERSONALIZATIONS.general.title;
      document.documentElement.dataset.transitionReason = 'fallback';
      return;
    }

    if (kicker) kicker.textContent = personalization.kicker;
    if (heading) heading.textContent = personalization.heading;
    if (message) {
      const personalizedMessage = givenName
        ? `${givenName}, ${personalization.message.charAt(0).toLowerCase()}${personalization.message.slice(1)}`
        : personalization.message;
      message.textContent = personalizedMessage;
    }
    if (finalKicker) finalKicker.textContent = personalization.finalKicker;
    if (finalMessageText) finalMessageText.textContent = personalization.finalMessage;
    if (document) document.title = personalization.title;
    document.documentElement.dataset.transitionReason = reasonKey;
  };

  const setPropertyState = (confirmed) => {
    if (!hasPropertyAddress || !propertyCard) return;
    setNodeState(propertyCard, confirmed ? 'confirmed' : 'pending');
    if (propertyLabel) propertyLabel.textContent = confirmed ? propertyCopy.confirmed : propertyCopy.pending;
    if (propertyDetail) propertyDetail.textContent = confirmed
      ? 'Preparing your personalized review…'
      : 'Matching this review to the address you provided…';
    document.documentElement.dataset.transitionProperty = confirmed ? 'confirmed' : 'pending';
  };

  const applyPropertyConfirmation = () => {
    if (!propertyCard) return;
    if (!hasPropertyAddress) {
      propertyCard.hidden = true;
      document.documentElement.dataset.transitionProperty = 'unavailable';
      return;
    }
    propertyCard.hidden = false;
    if (propertyAddressText) propertyAddressText.textContent = propertyAddress;
    setPropertyState(false);
  };

  const configureTimeline = () => {
    stepNodes.forEach((node, index) => {
      const labelNode = typeof node.querySelector === 'function'
        ? node.querySelector('.transition-step-label')
        : null;
      if (labelNode) labelNode.textContent = stepLabels[index] || '';
      setNodeState(node, index === 0 ? 'active' : 'pending');
      setCurrent(node, index === 0);
    });
    setNodeState(finalMessage, 'pending');
    currentStep = 0;
    announce(stepLabels[0]);
  };

  const showStep = (index) => {
    if (completed || index < 0 || index >= stepNodes.length) return;
    stepNodes.forEach((node, nodeIndex) => {
      setNodeState(node, nodeIndex < index ? 'complete' : nodeIndex === index ? 'active' : 'pending');
      setCurrent(node, nodeIndex === index);
    });
    currentStep = index;
    if (index === 1 && hasPropertyAddress) {
      setPropertyState(true);
      announce(`${propertyCopy.confirmed} for ${propertyAddress}`);
    } else {
      announce(stepLabels[index]);
    }
    document.documentElement.dataset.transitionStep = String(index + 1);
  };

  const showFinal = () => {
    if (completed) return;
    stepNodes.forEach((node) => {
      setNodeState(node, 'complete');
      setCurrent(node, false);
    });
    setNodeState(finalMessage, 'active');
    if (hasPropertyAddress) setPropertyState(true);
    currentStep = stepNodes.length;
    const visibleFinalMessage = hasHandoff ? personalization.finalMessage : 'Opening CoverageFit';
    announce(`Almost ready. ${visibleFinalMessage}.`);
    document.documentElement.dataset.transitionStep = 'final';
  };

  const schedule = (callback, delay) => {
    const timerId = window.setTimeout(callback, delay);
    scheduledTimers.push(timerId);
    return timerId;
  };

  const cancelScheduledTimers = () => {
    if (typeof window.clearTimeout !== 'function') return;
    while (scheduledTimers.length) window.clearTimeout(scheduledTimers.pop());
  };

  const cancelFocusFrame = () => {
    if (focusFrame === null) return;
    if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(focusFrame);
    focusFrame = null;
  };

  const focusTransition = () => {
    if (!heading || typeof heading.focus !== 'function' || completed) return;
    heading.focus({ preventScroll: true });
    document.documentElement.dataset.transitionFocus = 'ready';
    focusFrame = null;
  };

  const focusAfterPaint = () => {
    if (typeof window.requestAnimationFrame === 'function') {
      focusFrame = window.requestAnimationFrame(focusTransition);
      return;
    }
    focusTransition();
  };

  const cleanupRuntime = () => {
    cancelScheduledTimers();
    cancelFocusFrame();
    if (navigationTimer !== null && typeof window.clearTimeout === 'function') {
      window.clearTimeout(navigationTimer);
      navigationTimer = null;
    }
  };

  document.documentElement.dataset.transitionPhase = 'active';
  document.documentElement.dataset.transitionMotion = reducedMotion ? 'reduced' : 'full';
  document.documentElement.dataset.transitionStep = '1';
  if (document.body) document.body.setAttribute('aria-busy', 'true');
  if (continueLink) continueLink.href = destination;

  applyPersonalization();
  applyPropertyConfirmation();

  if (hasHandoff) {
    document.documentElement.dataset.transitionState = 'ready';
  } else {
    document.documentElement.dataset.transitionState = 'fallback';
  }

  configureTimeline();
  focusAfterPaint();

  const navigate = () => {
    navigationTimer = null;
    try { window.location.replace(destination); } catch (_) { window.location.href = destination; }
  };

  const complete = () => {
    if (completed) return;
    completed = true;
    cancelScheduledTimers();
    cancelFocusFrame();
    if (hasHandoff) {
      try {
        sessionStorage.setItem(WELCOME_STORAGE_KEY, JSON.stringify({
          version: '1.0',
          hasProfile: true,
          reasonKey,
          destination,
          sessionId: cleanDisplayText(personalizationContext?.sessionId || profile?.integration?.sessionId, 120),
          completedAt: new Date().toISOString()
        }));
      } catch (_) {}
    }
    try { sessionStorage.removeItem(TRANSITION_STORAGE_KEY); } catch (_) {}
    if (document.body) document.body.setAttribute('aria-busy', 'false');
    document.documentElement.dataset.transitionPhase = 'leaving';
    navigationTimer = window.setTimeout(navigate, reducedMotion ? 0 : EXIT_DELAY);
  };

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', cleanupRuntime, { once: true });
  }

  if (continueLink) {
    continueLink.addEventListener('click', (event) => {
      event.preventDefault();
      complete();
    });
  }

  if (reducedMotion) {
    showFinal();
    completionTimer = schedule(complete, REDUCED_MOTION_DELAY);
  } else {
    for (let index = 1; index < stepNodes.length; index += 1) {
      schedule(() => showStep(index), STEP_INTERVAL * index);
    }
    schedule(showFinal, FINAL_STEP_AT);
    completionTimer = schedule(complete, DEFAULT_DELAY);
  }

  window.CoverageFitTransition = Object.freeze({
    version: VERSION,
    destination,
    hasHandoff,
    reasonKey,
    personalized: hasHandoff && reasonKey !== 'general',
    propertyConfirmed: hasPropertyAddress,
    complete,
    timer: completionTimer,
    navigationTimer: () => navigationTimer,
    currentStep: () => currentStep,
    timeline: Object.freeze({
      stepCount: PERSONALIZATIONS.general.steps.length,
      interval: STEP_INTERVAL,
      finalAt: FINAL_STEP_AT,
      totalDuration: reducedMotion ? REDUCED_MOTION_DELAY : DEFAULT_DELAY
    })
  });
})();
