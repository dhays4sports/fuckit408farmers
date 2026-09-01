// Always open landing pages at the top instead of restoring a previous scroll position.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const resetLandingScroll = () => {
  const hasContinuity = Boolean(window.HomeJourneyContinuity?.read?.());
  if (!location.hash && !hasContinuity) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
};
window.addEventListener('pageshow', () => {
  resetLandingScroll();
  setTimeout(resetLandingScroll, 50);
});

(() => {
  const HANDOFF_BUILD = '408-DISCOVERY-1.0';
  const HANDOFF_CONTRACT = 'coveragefit-secure-discovery-handoff-v1';
  const HANDOFF_VERSION = '2.0';
  const CONSENT_VERSION = '408farmers-agency-contact-v2';
  const AUTOMATED_MARKETING_SMS_CONSENT_VERSION = '408farmers-automated-marketing-sms-v1';
  const LEAD_SUBMISSION_TIMEOUT_MS = 8000;
  const DIRECT_FORMSPREE_ENDPOINT = 'https://formspree.io/f/mojgnegn';
  const PENDING_LEAD_KEY = '408farmersLeadPending';
  const form = document.getElementById('leadForm');
  const status = document.getElementById('formStatus');
  const config = window.LANDING_PAGE_CONFIG || {};
  const continuity = window.HomeJourneyContinuity || null;
  if (!form) return;

  const emitHomeJourney = (eventName, properties = {}) => {
    if (form.dataset.homeJourney !== 'true') return null;
    return window.HomeJourneyBaseline?.emit?.(eventName, properties) || null;
  };

  const params = new URLSearchParams(location.search);
  const attributionQueryFields = [
    'source','partner_id','perk_id','merchant_slug','surface','campaign','variant','creative',
    'campaign_id','campaign_variant','campaign_zip',
    'utm_source','utm_medium','utm_campaign','utm_content','utm_term'
  ];
  const explicitAttribution = attributionQueryFields.some(k => params.has(k));
  let storedLocalContext = null;
  if (!explicitAttribution) {
    try {
      const record = JSON.parse(localStorage.getItem('408farmers_local_attribution_v1') || 'null');
      if (record && record.schema_version === '408-local-attribution-v1' && Number(record.expires_at) > Date.now() && record.context && record.context.source === 'local') {
        storedLocalContext = record.context;
      }
    } catch (_) {}
  }
  const localCampaignId = context => ['local', context.partner_id || context.merchant_slug || 'directory', context.surface || 'directory']
    .map(value => String(value || 'local').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 50) || 'local')
    .join('-').slice(0, 160);
  attributionQueryFields.forEach(k => {
    let value = params.has(k) ? (params.get(k) || '') : '';
    if (!value && storedLocalContext) {
      if (k === 'campaign_id') value = localCampaignId(storedLocalContext);
      else if (k === 'campaign_variant') value = storedLocalContext.variant || '';
      else value = storedLocalContext[k] || '';
    }
    if (!params.has(k) && !storedLocalContext) return;
    let input = form.querySelector(`[name="${k}"]`);
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      form.appendChild(input);
    }
    input.value = value;
  });

  const pageInput = form.querySelector('[name="landing_page"]');
  if (pageInput) pageInput.value = location.href;
  const timeInput = form.querySelector('[name="submitted_at"]');
  if (timeInput) timeInput.value = new Date().toISOString();

  const normalizePhone = value => value.replace(/\D/g,'');
  const leadSnapshot = () => Object.fromEntries(new FormData(form).entries());
  const setLeadField = (name, value) => {
    let input = form.elements[name];
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }
    input.value = String(value || '');
    return input;
  };
  const professionalContext = () => ({
    professional_program: String(form.elements.professional_program?.value || '').trim(),
    professional_role: String(form.elements.professional_role?.value || '').trim(),
    professional_role_label: String(form.elements.professional_role_label?.value || '').trim()
  });
  const emitSafeFunnel = (eventName, properties = {}) => {
    if (form.dataset.techProgressive !== 'true') return;
    const safe = Object.assign({ event: eventName, funnel: 'tech_pvx', route: '/tech/' }, properties);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(safe);
    try { document.dispatchEvent(new CustomEvent('408farmers:' + eventName, { detail: safe })); } catch (_) {}
  };
  const storePendingLead = () => {
    try {
      sessionStorage.setItem(PENDING_LEAD_KEY, JSON.stringify(leadSnapshot()));
    } catch (_) {}
  };
  const clearPendingLead = () => {
    try {
      sessionStorage.removeItem(PENDING_LEAD_KEY);
    } catch (_) {}
  };

  const branchPlan = () => {
    const branchField = form.dataset.cfBranchField;
    if (!branchField || !form.elements[branchField]) return { destinationType: 'coveragefit', destination: '', propertyRequired: true, key: '' };
    const value = String(form.elements[branchField].value || '').trim().toLowerCase();
    const bounded = continuity?.resolveBranch?.(value);
    if (bounded) return bounded;
    if (value === 'renter' || /^i rent\b/.test(value)) {
      return { destinationType: 'coveragefit', destination: '/pvx/discovery/', propertyRequired: false, key: 'renter' };
    }
    return { destinationType: 'coveragefit', destination: '', propertyRequired: true, key: value };
  };

  const launchAnonymousDiscovery = () => {
    if (!window.CoverageFitLauncher) {
      status.textContent = 'CoverageFit could not be opened. Please retry in a moment.';
      return;
    }
    const contextProfile = window.ProspectProfileBuilder
      ? window.ProspectProfileBuilder.fromForm(form)
      : null;
    window.ProspectProfileBuilder?.clear?.();
    continuity?.clear?.();
    emitHomeJourney('home_early_capture_skipped', {
      stage: window.HomeJourneyContract?.STAGES?.LEAD_CAPTURE || 'lead_capture',
      lead_capture_status: 'skipped'
    });
    status.textContent = 'Opening your anonymous CoverageFit review…';
    window.CoverageFitLauncher.launch({
      profile: contextProfile,
      campaign: contextProfile?.campaign || (form.elements.campaign ? form.elements.campaign.value : null),
      entry: form.dataset.cfEntry || 'home_lander_form',
      assessment: form.dataset.cfAssessment || 'home',
      next: '/pvx/discovery/',
      fallbackUrl: form.dataset.success || 'thank-you.html',
      extra: {
        launch_surface: form.dataset.cfExtraLaunchSurface || 'home_lander',
        lead_captured: 'false',
        lead_capture_status: 'skipped',
        contact_consent: 'false',
        sender_build: form.dataset.senderBuild || HANDOFF_BUILD,
        handoff_contract: form.dataset.handoffContract || HANDOFF_CONTRACT,
        handoff_version: HANDOFF_VERSION,
        ...professionalContext()
      }
    });
  };

  document.addEventListener?.('408farmers:continue-without-saving', launchAnonymousDiscovery);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent='';

    if (!form.checkValidity()) {
      const firstInvalid = Array.from(form.elements).find(control => control.willValidate && !control.checkValidity());
      status.textContent = 'Please complete the highlighted field before continuing.';
      form.reportValidity();
      if (firstInvalid && firstInvalid.offsetParent !== null) firstInvalid.focus();
      return;
    }

    const submittedAt = new Date().toISOString();
    if (timeInput) timeInput.value = submittedAt;
    const marketingSmsInput = form.elements.automated_marketing_sms_consent;
    const marketingSmsConsentGranted = Boolean(marketingSmsInput && marketingSmsInput.checked);
    const marketingSmsConsentVersion = form.elements.automated_marketing_sms_consent_version?.value || AUTOMATED_MARKETING_SMS_CONSENT_VERSION;
    const marketingSmsConsentAt = marketingSmsConsentGranted ? submittedAt : '';
    if (form.elements.automated_marketing_sms_consent_timestamp) {
      form.elements.automated_marketing_sms_consent_timestamp.value = marketingSmsConsentAt;
    }

    const phone = normalizePhone(form.elements.phone.value);
    if (phone.length < 10) {
      status.textContent='Please enter a valid phone number.';
      form.elements.phone.focus();
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    const label = button.querySelector('span:first-child');
    const original = label.textContent;
    button.disabled=true;
    label.textContent='Submitting…';

    const proxyEndpoint=(config.leadProxyEndpoint||'/api/lead').trim();
    const directEndpoint=(config.formEndpoint||form.getAttribute('action')||DIRECT_FORMSPREE_ENDPOINT).trim();
    const prospectProfile = window.ProspectProfileBuilder
      ? window.ProspectProfileBuilder.fromForm(form)
      : null;

    if (prospectProfile && window.ProspectProfileBuilder) {
      window.ProspectProfileBuilder.save(prospectProfile);
    }

    const handoffCampaign = prospectProfile && prospectProfile.campaign
      ? prospectProfile.campaign
      : (form.elements.campaign ? form.elements.campaign.value : null);
    const consentInput = form.elements.consent;
    const contactConsentConfirmed = Boolean(consentInput && consentInput.checked);
    const consentEvidenceAt = form.elements.contact_consent_timestamp?.value || submittedAt;
    const consentEvidenceVersion = form.elements.contact_consent_version?.value || CONSENT_VERSION;
    setLeadField('lead_checkpoint_id', prospectProfile?.leadCheckpointId || prospectProfile?.integration?.leadCheckpointId || '');
    setLeadField('lead_stage', 'started');
    setLeadField('contact_consent_state', contactConsentConfirmed ? 'granted' : 'not_granted');
    setLeadField('contact_consent_version', contactConsentConfirmed ? consentEvidenceVersion : '');
    setLeadField('contact_consent_timestamp', contactConsentConfirmed ? consentEvidenceAt : '');
    setLeadField('automated_marketing_sms_consent_state', marketingSmsConsentGranted ? 'granted' : 'not_granted');
    setLeadField('automated_marketing_sms_consent_version', marketingSmsConsentGranted ? marketingSmsConsentVersion : '');
    setLeadField('automated_marketing_sms_consent_timestamp', marketingSmsConsentAt);
    setLeadField('review_track', prospectProfile?.discovery?.productTrack || '');
    const professional = professionalContext();
    setLeadField('professional_program', professional.professional_program);
    setLeadField('professional_role', professional.professional_role);
    setLeadField('professional_role_label', professional.professional_role_label);
    setLeadField('landing_page', location.origin + location.pathname);

    const emitLeadSubmissionStatus = (leadCaptureStatus) => {
      const events = window.HomeJourneyContract?.EVENTS;
      const stages = window.HomeJourneyContract?.STAGES;
      if (!events) return;
      const leadEvent = leadCaptureStatus === 'confirmed'
        ? events.LEAD_SUBMISSION_CONFIRMED
        : leadCaptureStatus === 'pending'
          ? events.LEAD_SUBMISSION_PENDING
          : events.LEAD_SUBMISSION_UNCONFIRMED;
      emitHomeJourney(leadEvent, {
        stage: stages?.CONFIRMATION || 'confirmation',
        status: leadCaptureStatus,
        lead_capture_status: leadCaptureStatus
      });
    };

    const continueToCoverageFit = (leadCaptureStatus = 'confirmed') => {
      emitLeadSubmissionStatus(leadCaptureStatus);

      const openDestination = () => {
        const branch = branchPlan();
        const currentProfile = window.ProspectProfileBuilder
          ? window.ProspectProfileBuilder.fromForm(form)
          : prospectProfile;
        if (currentProfile && window.ProspectProfileBuilder) {
          window.ProspectProfileBuilder.save(currentProfile);
        }

        if (form.dataset.homeJourney === 'true') {
          continuity?.markHandoff?.(form, {
            leadCaptureStatus,
            submittedAt,
            branch: branch.key,
            destinationType: branch.destinationType
          });
        }

        if (form.dataset.coveragefitAfterSubmit !== 'true') {
          location.href=form.dataset.success||'thank-you.html';
          return;
        }

        if (!window.CoverageFitLauncher) {
          location.href=form.dataset.success||'thank-you.html';
          return;
        }

        const events = window.HomeJourneyContract?.EVENTS;
        const stages = window.HomeJourneyContract?.STAGES;
        if (events) {
          emitHomeJourney(events.COVERAGEFIT_LAUNCHED, {
            stage: stages?.COVERAGEFIT_HANDOFF || 'coveragefit_handoff',
            status: leadCaptureStatus,
            lead_capture_status: leadCaptureStatus
          });
        }

        label.textContent='Opening CoverageFit…';
        window.CoverageFitLauncher.launch({
          profile: currentProfile,
          campaign: handoffCampaign,
          entry: form.dataset.cfEntry || 'lead_form',
          assessment: form.dataset.cfAssessment || 'home',
          next: form.dataset.cfNext || '/pvx/discovery/',
          fallbackUrl: form.dataset.success || 'thank-you.html',
          extra: {
            launch_surface: form.dataset.cfExtraLaunchSurface || 'lead_form',
            lead_captured: leadCaptureStatus === 'confirmed' ? 'true' : 'pending',
            lead_capture_status: leadCaptureStatus,
            sender_build: form.dataset.senderBuild || HANDOFF_BUILD,
            handoff_contract: form.dataset.handoffContract || HANDOFF_CONTRACT,
            handoff_version: HANDOFF_VERSION,
            contact_consent: contactConsentConfirmed ? 'true' : 'false',
            consent_at: consentEvidenceAt,
            consent_version: consentEvidenceVersion,
            automated_marketing_sms_consent: marketingSmsConsentGranted ? 'true' : 'false',
            automated_marketing_sms_consent_version: marketingSmsConsentGranted ? marketingSmsConsentVersion : '',
            automated_marketing_sms_consent_timestamp: marketingSmsConsentAt,
            submitted_at: submittedAt,
            ...professionalContext()
          }
        });
      };

      const engagementStarted = form.dataset.postLeadEngagement === 'true'
        && window.PostLeadEngagement
        && typeof window.PostLeadEngagement.present === 'function'
        && window.PostLeadEngagement.present({
          leadCaptureStatus,
          onContinue: openDestination
        });
      if (engagementStarted) return;

      const invitationStarted = form.dataset.coveragefitInvitation === 'true'
        && window.CoverageFitInvitation
        && typeof window.CoverageFitInvitation.present === 'function'
        && window.CoverageFitInvitation.present({
          leadCaptureStatus,
          destinationType: 'coveragefit',
          onContinue: openDestination
        });
      if (invitationStarted) return;

      if (form.dataset.coveragefitInvitation === 'true') {
        // Safe degraded mode: retain the completed lead and require a new,
        // explicit click before opening CoverageFit. Never restore the old
        // automatic confirmation timer for an invitation-enabled route.
        status.textContent = 'Your request is complete. CoverageFit is optional; choose below only if you want to continue now.';
        button.disabled = false;
        button.type = 'button';
        label.textContent = 'Continue to CoverageFit (Optional)';
        button.addEventListener('click', openDestination, { once: true });
        return;
      }

      const confirmationStarted = form.dataset.homeConfirmation === 'true'
        && window.HomeLeadConfirmation
        && typeof window.HomeLeadConfirmation.show === 'function'
        && window.HomeLeadConfirmation.show({
          leadCaptureStatus,
          destinationType: 'coveragefit',
          onContinue: openDestination
        });
      if (!confirmationStarted) openDestination();
    };

    const fetchWithTimeout = async (url, options, timeoutMs = LEAD_SUBMISSION_TIMEOUT_MS) => {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = setTimeout(() => controller?.abort(), timeoutMs);
      try {
        return await fetch(url, Object.assign({}, options, controller ? { signal: controller.signal } : {}));
      } finally {
        clearTimeout(timer);
      }
    };

    const postLead = async (endpoint) => {
      if (!endpoint) throw new Error('missing_endpoint');
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
        credentials: endpoint.startsWith('/') ? 'same-origin' : 'omit'
      });
      if (!response.ok) {
        let detail = '';
        try { detail = await response.text(); } catch (_) {}
        const error = new Error('lead_submission_failed_' + response.status);
        error.status = response.status;
        error.detail = detail.slice(0, 240);
        throw error;
      }
      return response;
    };

    const submitLead = async () => {
      let proxyError = null;
      if (proxyEndpoint) {
        try {
          await postLead(proxyEndpoint);
          clearPendingLead();
          return 'confirmed';
        } catch (error) {
          proxyError = error;
        }
      }

      // Browser-direct Formspree is the second transport. This preserves the
      // normal Referer header used by Formspree's domain restriction feature.
      if (directEndpoint) {
        try {
          await postLead(directEndpoint);
          clearPendingLead();
          return 'confirmed';
        } catch (directError) {
          directError.proxyError = proxyError;
          throw directError;
        }
      }
      throw proxyError || new Error('missing_lead_transport');
    };

    emitHomeJourney(window.HomeJourneyContract?.EVENTS?.LEAD_SUBMISSION_ATTEMPTED, {
      stage: window.HomeJourneyContract?.STAGES?.LEAD_CAPTURE || 'lead_capture',
      status: 'attempted'
    });

    // Lead delivery is now a hard gate. Do not race the transport and do not
    // navigate away while the request is still in flight. This prevents a
    // successful-looking CoverageFit handoff when Formspree never received the lead.
    storePendingLead();
    status.textContent = 'Sending your request securely…';
    try {
      await submitLead();
      status.textContent = '';
      emitSafeFunnel('early_lead_confirmed', {
        professional_role: professionalContext().professional_role,
        housing_context: String(form.elements.housing_context?.value || '')
      });
      try {
        emitSafeFunnel('coveragefit_started', {
          professional_role: professionalContext().professional_role,
          housing_context: String(form.elements.housing_context?.value || '')
        });
        continueToCoverageFit('confirmed');
      } catch (handoffError) {
        // The lead is already confirmed. Never strand the user because an
        // optional post-lead module throws.
        if (form.dataset.coveragefitAfterSubmit === 'true' && window.CoverageFitLauncher) {
          window.CoverageFitLauncher.launch({
            profile: prospectProfile,
            campaign: handoffCampaign,
            entry: form.dataset.cfEntry || 'lead_form',
            assessment: form.dataset.cfAssessment || 'home',
            next: form.dataset.cfNext || '/pvx/discovery/',
            fallbackUrl: form.dataset.success || 'thank-you.html',
            extra: {
              lead_captured: 'true', lead_capture_status: 'confirmed', contact_consent: contactConsentConfirmed ? 'true' : 'false',
              consent_at: consentEvidenceAt, consent_version: consentEvidenceVersion, submitted_at: submittedAt,
              automated_marketing_sms_consent: marketingSmsConsentGranted ? 'true' : 'false',
              automated_marketing_sms_consent_version: marketingSmsConsentGranted ? marketingSmsConsentVersion : '',
              automated_marketing_sms_consent_timestamp: marketingSmsConsentAt,
              sender_build: form.dataset.senderBuild || HANDOFF_BUILD,
              handoff_contract: form.dataset.handoffContract || HANDOFF_CONTRACT,
              handoff_version: HANDOFF_VERSION,
              ...professionalContext()
            }
          });
        } else {
          location.href = form.dataset.success || 'thank-you.html';
        }
      }
    } catch (error) {
      button.disabled = false;
      label.textContent = original;
      status.textContent = 'We could not confirm that your information was saved. Retry, or choose Continue without saving to keep going anonymously.';
    }
  });

  document.addEventListener?.('408farmers:home-handoff-retry', (event) => {
    const saved = event?.detail || continuity?.read?.();
    if (!saved || saved.stage !== 'handoff_recovery') return;
    const profile = window.ProspectProfileBuilder?.load?.() || null;
    if (!profile) {
      continuity?.clear?.();
      status.textContent = 'Your saved handoff expired. Your quick questions can be restarted below.';
      window.location.reload();
      return;
    }

    const branch = continuity?.resolveBranch?.(saved.housingContext) || branchPlan();
    emitHomeJourney(window.HomeJourneyContract?.EVENTS?.HANDOFF_RECOVERY_CONTINUED, {
      stage: window.HomeJourneyContract?.STAGES?.COVERAGEFIT_HANDOFF || 'coveragefit_handoff',
      recovery_type: 'saved_handoff',
      branch: branch?.key || '',
      destination_type: branch?.destinationType || 'coveragefit',
      lead_capture_status: saved.leadCaptureStatus || 'pending'
    });

    if (!window.CoverageFitLauncher) {
      location.href = form.dataset.success || 'thank-you.html';
      return;
    }

    emitHomeJourney(window.HomeJourneyContract?.EVENTS?.COVERAGEFIT_LAUNCHED, {
      stage: window.HomeJourneyContract?.STAGES?.COVERAGEFIT_HANDOFF || 'coveragefit_handoff',
      status: saved.leadCaptureStatus || 'pending',
      recovery_type: 'saved_handoff'
    });
    window.CoverageFitLauncher.launch({
      profile,
      campaign: profile.campaign || saved.campaignId || null,
      entry: form.dataset.cfEntry || 'home_lander_form',
      assessment: form.dataset.cfAssessment || 'home',
      next: form.dataset.cfNext || '/pvx/discovery/',
      fallbackUrl: form.dataset.success || 'thank-you.html',
      extra: {
        launch_surface: form.dataset.cfExtraLaunchSurface || 'home_lander',
        lead_captured: saved.leadCaptureStatus === 'confirmed' ? 'true' : 'pending',
        lead_capture_status: saved.leadCaptureStatus || 'pending',
        sender_build: form.dataset.senderBuild || '408-HOME-2.9',
        handoff_contract: form.dataset.handoffContract || HANDOFF_CONTRACT,
        handoff_version: HANDOFF_VERSION,
        contact_consent: profile.contactPermission?.confirmed ? 'true' : 'false',
        consent_at: profile.contactPermission?.capturedAt || saved.submittedAt || '',
        consent_version: profile.contactPermission?.version || CONSENT_VERSION,
        automated_marketing_sms_consent: profile.contactPermission?.automatedMarketingSms?.granted ? 'true' : 'false',
        automated_marketing_sms_consent_version: profile.contactPermission?.automatedMarketingSms?.version || '',
        automated_marketing_sms_consent_timestamp: profile.contactPermission?.automatedMarketingSms?.capturedAt || '',
        submitted_at: saved.submittedAt || ''
      }
    });
  });

  document.addEventListener?.('408farmers:home-journey-restarted', () => {
    clearPendingLead();
    window.ProspectProfileBuilder?.clear?.();
  });
})();
