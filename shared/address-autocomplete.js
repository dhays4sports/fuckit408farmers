/**
 * 408-ADDR-1H — Production Places library loading and diagnostics.
 *
 * Uses the current Autocomplete Data API instead of the legacy
 * google.maps.places.Autocomplete widget. The native form input always remains
 * editable, while Google suggestions are rendered in an accessible custom
 * list. Manual entry remains valid if Google is unavailable or no suggestion
 * is selected.
 */
(() => {
  'use strict';

  const config = window.LANDING_PAGE_CONFIG || {};
  const apiKey = String(config.googlePlacesApiKey || '').trim();
  const input = document.querySelector('[data-address-autocomplete="property"]');

  if (!input) return;

  const form = input.closest('form');
  const fieldLabel = input.closest('label');
  const root = document.documentElement;
  const MIN_QUERY_LENGTH = 3;
  const REQUEST_DELAY_MS = 220;
  const SCRIPT_LOAD_TIMEOUT_MS = 15000;
  const GOOGLE_READY_CALLBACK = '__coverageFitGooglePlacesReady';
  const CALIFORNIA_BOUNDS = {
    west: -124.6509,
    north: 42.0126,
    east: -114.1312,
    south: 32.5121
  };

  let selectedFormattedAddress = '';
  let placesReady = false;
  let AutocompleteSuggestion = null;
  let AutocompleteSessionToken = null;
  let sessionToken = null;
  let requestTimer = null;
  let newestRequestId = 0;
  let activeIndex = -1;
  let currentPredictions = [];

  const hiddenFieldNames = [
    'property_formatted_address',
    'property_street',
    'property_city',
    'property_county',
    'property_state',
    'property_zip',
    'property_country',
    'property_place_id',
    'address_selection_method'
  ];

  const ensureHiddenField = (name) => {
    if (!form) return null;
    const existing = form.querySelector(`[name="${name}"]`);
    if (existing) return existing;
    const field = document.createElement('input');
    field.type = 'hidden';
    field.name = name;
    form.appendChild(field);
    return field;
  };

  // Buyer and Home already declare these fields in markup. Creating any
  // missing fields lets every other property-owning funnel use the same
  // structured-address handoff without duplicating nine hidden inputs.
  const hiddenFields = Object.fromEntries(hiddenFieldNames.map((name) => [
    name,
    ensureHiddenField(name)
  ]));

  const setHiddenValue = (name, value) => {
    if (hiddenFields[name]) hiddenFields[name].value = String(value || '').trim();
  };

  const clearStructuredAddress = () => {
    [
      'property_formatted_address',
      'property_street',
      'property_city',
      'property_county',
      'property_state',
      'property_zip',
      'property_country',
      'property_place_id'
    ].forEach((name) => setHiddenValue(name, ''));

    setHiddenValue('address_selection_method', 'manual');
    selectedFormattedAddress = '';
    input.dataset.addressSelectionMethod = 'manual';
  };

  const componentValue = (components, type, format = 'long') => {
    const component = components.find((item) => (
      Array.isArray(item.types) && item.types.includes(type)
    ));

    if (!component) return '';

    if (format === 'short') {
      return component.shortText
        || component.short_name
        || component.longText
        || component.long_name
        || '';
    }

    return component.longText
      || component.long_name
      || component.shortText
      || component.short_name
      || '';
  };

  const parsePlace = (place) => {
    const components = Array.isArray(place?.addressComponents)
      ? place.addressComponents
      : Array.isArray(place?.address_components)
        ? place.address_components
        : [];

    const streetNumber = componentValue(components, 'street_number');
    const route = componentValue(components, 'route');

    const city = componentValue(components, 'locality')
      || componentValue(components, 'postal_town')
      || componentValue(components, 'sublocality_level_1')
      || componentValue(components, 'administrative_area_level_3');

    return {
      formattedAddress:
        place?.formattedAddress
        || place?.formatted_address
        || input.value.trim(),

      street: [streetNumber, route].filter(Boolean).join(' '),

      city,

      county: componentValue(
        components,
        'administrative_area_level_2'
      ),

      state: componentValue(
        components,
        'administrative_area_level_1',
        'short'
      ),

      postalCode: componentValue(
        components,
        'postal_code'
      ),

      country: componentValue(
        components,
        'country',
        'short'
      ),

      placeId: place?.id || place?.place_id || ''
    };
  };

  const storeStructuredAddress = (address) => {
    setHiddenValue(
      'property_formatted_address',
      address.formattedAddress
    );

    setHiddenValue(
      'property_street',
      address.street
    );

    setHiddenValue(
      'property_city',
      address.city
    );

    setHiddenValue(
      'property_county',
      address.county
    );

    setHiddenValue(
      'property_state',
      address.state
    );

    setHiddenValue(
      'property_zip',
      address.postalCode
    );

    setHiddenValue(
      'property_country',
      address.country
    );

    setHiddenValue(
      'property_place_id',
      address.placeId
    );

    setHiddenValue(
      'address_selection_method',
      'autocomplete'
    );

    selectedFormattedAddress = address.formattedAddress;
    input.dataset.addressSelectionMethod = 'autocomplete';
  };

  const syncManualAddressForSubmit = () => {
    const typedAddress = input.value.trim();

    if (
      !selectedFormattedAddress
      || typedAddress !== selectedFormattedAddress
    ) {
      clearStructuredAddress();

      setHiddenValue(
        'property_formatted_address',
        typedAddress
      );

      setHiddenValue(
        'address_selection_method',
        'manual'
      );
    }

    form?.dispatchEvent(new CustomEvent('address:ready', {
      bubbles: true,
      detail: {
        method:
          hiddenFields.address_selection_method?.value
          || 'manual',

        formattedAddress:
          hiddenFields.property_formatted_address?.value
          || typedAddress
      }
    }));
  };

  const helper = document.createElement('span');
  helper.className = 'address-autocomplete-helper';
  helper.id = `${input.id || 'property-address'}-autocomplete-help`;
  helper.setAttribute('aria-live', 'polite');
  helper.textContent =
    'Start typing your property address. You can also enter it manually.';

  const suggestionList = document.createElement('div');
  suggestionList.className = 'address-suggestion-list';
  suggestionList.id =
    `${input.id || 'property-address'}-suggestions`;
  suggestionList.setAttribute('role', 'listbox');
  suggestionList.setAttribute(
    'aria-label',
    'Likely property addresses'
  );
  suggestionList.hidden = true;

  if (fieldLabel) {
    fieldLabel.classList?.add('address-autocomplete-field');
    fieldLabel.appendChild(suggestionList);
    fieldLabel.appendChild(helper);
  }

  input.setAttribute('aria-describedby', helper.id);
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', suggestionList.id);
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('role', 'combobox');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('autocomplete', 'off');

  clearStructuredAddress();

  const setState = (state) => {
    input.dataset.addressAutocompleteState = state;
    root.dataset.addressAutocompleteState = state;

    if (state === 'ready') {
      helper.textContent =
        input.value.trim().length >= MIN_QUERY_LENGTH
          ? 'Choose the best matching address, or keep typing to enter it manually.'
          : 'Type at least 3 characters to see likely addresses.';
    } else if (state === 'loading') {
      helper.textContent =
        'Loading smart address suggestions. Manual entry is still available.';
    } else {
      helper.textContent =
        'Enter the property address manually.';
    }
  };

  const closeSuggestions = () => {
    suggestionList.hidden = true;
    suggestionList.replaceChildren();

    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');

    currentPredictions = [];
    activeIndex = -1;
  };

  const setActiveSuggestion = (nextIndex) => {
    const options = Array.from(
      suggestionList.querySelectorAll('[role="option"]')
    );

    if (!options.length) return;

    activeIndex = Math.max(
      0,
      Math.min(nextIndex, options.length - 1)
    );

    options.forEach((option, index) => {
      const active = index === activeIndex;

      option.classList.toggle('is-active', active);
      option.setAttribute(
        'aria-selected',
        String(active)
      );
    });

    input.setAttribute(
      'aria-activedescendant',
      options[activeIndex].id
    );

    options[activeIndex].scrollIntoView?.({
      block: 'nearest'
    });
  };

  const resetSession = () => {
    sessionToken = AutocompleteSessionToken
      ? new AutocompleteSessionToken()
      : null;
  };

  const selectPrediction = async (prediction) => {
    if (!prediction) return;

    newestRequestId += 1;
    closeSuggestions();

    input.dataset.addressAutocompleteBusy = 'true';
    helper.textContent =
      'Confirming the selected address…';

    try {
      const place = prediction.toPlace();

      await place.fetchFields({
        fields: [
          'formattedAddress',
          'addressComponents'
        ]
      });

      const address = parsePlace(place);

      if (!address.formattedAddress) {
        throw new Error(
          'Selected place did not return an address.'
        );
      }

      input.value = address.formattedAddress;

      storeStructuredAddress(address);

      helper.textContent =
        'Address selected. You can edit it before submitting.';

      input.dispatchEvent(
        new Event('change', {
          bubbles: true
        })
      );

      resetSession();
    } catch (error) {
      console.warn(
        'Selected address could not be confirmed. Manual entry remains available.',
        error
      );

      clearStructuredAddress();

      helper.textContent =
        'We could not confirm that suggestion. You can keep entering the address manually.';
    } finally {
      input.dataset.addressAutocompleteBusy = 'false';
    }
  };

  const renderSuggestions = (predictions) => {
    suggestionList.replaceChildren();

    currentPredictions = predictions.slice(0, 5);
    activeIndex = -1;

    currentPredictions.forEach((prediction, index) => {
      const button = document.createElement('button');

      button.type = 'button';
      button.className = 'address-suggestion';
      button.id =
        `${suggestionList.id}-option-${index}`;

      button.setAttribute('role', 'option');
      button.setAttribute(
        'aria-selected',
        'false'
      );

      button.textContent =
        prediction.text?.toString?.() || '';

      button.addEventListener(
        'pointerdown',
        (event) => event.preventDefault()
      );

      button.addEventListener('click', () => {
        void selectPrediction(prediction);
      });

      suggestionList.appendChild(button);
    });

    if (!currentPredictions.length) {
      closeSuggestions();

      helper.textContent =
        'No likely match yet. Keep typing or enter the address manually.';

      return;
    }

    const attribution =
      document.createElement('div');

    attribution.className =
      'address-google-attribution';

    const logo = document.createElement('img');

    logo.src =
      'https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png';

    logo.alt = 'Powered by Google';

    attribution.appendChild(logo);
    suggestionList.appendChild(attribution);

    suggestionList.hidden = false;

    input.setAttribute(
      'aria-expanded',
      'true'
    );

    helper.textContent =
      'Choose the best matching address, or keep typing to enter it manually.';
  };

  const requestSuggestions = async (query) => {
    if (
      !placesReady
      || !AutocompleteSuggestion
    ) {
      return;
    }

    const requestId = ++newestRequestId;

    input.dataset.addressAutocompleteBusy = 'true';

    try {
      if (!sessionToken) {
        resetSession();
      }

      const {
        suggestions = []
      } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        includedRegionCodes: ['us'],
        locationRestriction: CALIFORNIA_BOUNDS,
        language: 'en-US',
        region: 'us',
        sessionToken
      });

      if (
        requestId !== newestRequestId
        || input.value.trim() !== query
      ) {
        return;
      }

      const predictions = suggestions
        .map((suggestion) => (
          suggestion.placePrediction
        ))
        .filter(Boolean);

      renderSuggestions(predictions);
    } catch (error) {
      if (requestId !== newestRequestId) {
        return;
      }

      console.warn(
        'Address suggestions are unavailable. Manual entry remains available.',
        error
      );

      closeSuggestions();
      setState('unavailable');
    } finally {
      if (requestId === newestRequestId) {
        input.dataset.addressAutocompleteBusy =
          'false';
      }
    }
  };

  const scheduleSuggestions = () => {
    if (requestTimer) {
      window.clearTimeout(requestTimer);
    }

    const query = input.value.trim();

    if (
      !placesReady
      || query.length < MIN_QUERY_LENGTH
    ) {
      newestRequestId += 1;
      closeSuggestions();
      return;
    }

    requestTimer = window.setTimeout(() => {
      requestTimer = null;
      void requestSuggestions(query);
    }, REQUEST_DELAY_MS);
  };

  const updateQueryState = () => {
    const currentValue = input.value.trim();

    const queryReady =
      currentValue.length >= MIN_QUERY_LENGTH;

    root.dataset.addressQueryReady =
      String(queryReady);

    input.dataset.addressQueryReady =
      String(queryReady);

    if (
      selectedFormattedAddress
      && currentValue !== selectedFormattedAddress
    ) {
      clearStructuredAddress();
      resetSession();
    } else if (!selectedFormattedAddress) {
      setHiddenValue(
        'address_selection_method',
        'manual'
      );
    }

    if (
      input.dataset.addressAutocompleteState
      === 'ready'
    ) {
      helper.textContent = queryReady
        ? 'Looking for likely addresses…'
        : 'Type at least 3 characters to see likely addresses.';
    }

    scheduleSuggestions();
  };

  input.addEventListener(
    'input',
    updateQueryState
  );

  input.addEventListener('paste', () => {
    window.setTimeout(
      updateQueryState,
      0
    );
  });

  input.addEventListener('focus', () => {
    updateQueryState();

    if (currentPredictions.length) {
      suggestionList.hidden = false;

      input.setAttribute(
        'aria-expanded',
        'true'
      );
    }
  });

  input.addEventListener('blur', () => {
    window.setTimeout(
      closeSuggestions,
      120
    );
  });

  input.addEventListener('keydown', (event) => {
    const listOpen =
      !suggestionList.hidden
      && currentPredictions.length > 0;

    if (
      event.key === 'ArrowDown'
      && listOpen
    ) {
      event.preventDefault();

      setActiveSuggestion(
        activeIndex + 1
      );
    } else if (
      event.key === 'ArrowUp'
      && listOpen
    ) {
      event.preventDefault();

      setActiveSuggestion(
        activeIndex <= 0
          ? currentPredictions.length - 1
          : activeIndex - 1
      );
    } else if (
      event.key === 'Enter'
      && listOpen
      && activeIndex >= 0
    ) {
      event.preventDefault();

      void selectPrediction(
        currentPredictions[activeIndex]
      );
    } else if (
      event.key === 'Escape'
      && listOpen
    ) {
      event.preventDefault();
      closeSuggestions();
    }
  });

  form?.addEventListener(
    'submit',
    syncManualAddressForSubmit,
    {
      capture: true
    }
  );

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!fieldLabel?.contains?.(event.target)) {
        closeSuggestions();
      }
    }
  );

  const publishDiagnosticState = (
    state,
    detail = ''
  ) => {
    window.__408FarmersAddressAutocomplete = {
      build: '408-ADDR-1H',
      state,
      detail,
      apiKeyConfigured: Boolean(apiKey),

      placesLibraryLoaded: Boolean(
        window.google?.maps?.places
      ),

      importLibraryAvailable: Boolean(
        window.google?.maps?.importLibrary
      )
    };
  };

  const initializeAutocomplete = async () => {
    if (placesReady) return;

    try {
      let placesLibrary =
        window.google?.maps?.places || null;

      if (window.google?.maps?.importLibrary) {
        placesLibrary =
          await window.google.maps.importLibrary(
            'places'
          );
      }

      AutocompleteSuggestion =
        placesLibrary?.AutocompleteSuggestion
        || window.google?.maps?.places
          ?.AutocompleteSuggestion
        || null;

      AutocompleteSessionToken =
        placesLibrary?.AutocompleteSessionToken
        || window.google?.maps?.places
          ?.AutocompleteSessionToken
        || null;

      if (
        !AutocompleteSuggestion
          ?.fetchAutocompleteSuggestions
        || !AutocompleteSessionToken
      ) {
        publishDiagnosticState(
          'unavailable',
          'Places library loaded without the current autocomplete classes.'
        );

        setState('unavailable');
        return;
      }

      placesReady = true;

      resetSession();
      setState('ready');

      publishDiagnosticState(
        'ready',
        'Google Places autocomplete is ready.'
      );

      updateQueryState();
    } catch (error) {
      console.warn(
        'Address autocomplete could not be initialized.',
        error
      );

      publishDiagnosticState(
        'unavailable',
        error?.message
        || 'Initialization failed.'
      );

      setState('unavailable');
    }
  };

  if (
    window.google?.maps?.importLibrary
    || window.google?.maps?.places
  ) {
    void initializeAutocomplete();
    return;
  }

  if (!apiKey) {
    publishDiagnosticState(
      'manual',
      'No Google Places browser key is configured.'
    );

    setState('manual');
    return;
  }

  const existingScript =
    document.querySelector(
      'script[data-google-places-loader]'
    );

  if (existingScript) {
    existingScript.addEventListener(
      'load',
      () => {
        void initializeAutocomplete();
      },
      {
        once: true
      }
    );

    existingScript.addEventListener(
      'error',
      () => {
        setState('unavailable');
      },
      {
        once: true
      }
    );

    return;
  }

  setState('loading');

  const script =
    document.createElement('script');

  let loadSettled = false;
  let loadTimeout = null;

  const settleLoaded = () => {
    if (loadSettled) return;

    loadSettled = true;

    if (loadTimeout) {
      window.clearTimeout(loadTimeout);
    }

    void initializeAutocomplete();
  };

  const settleUnavailable = (
    detail =
      'Google Maps JavaScript API did not load.'
  ) => {
    if (loadSettled) return;

    loadSettled = true;

    if (loadTimeout) {
      window.clearTimeout(loadTimeout);
    }

    closeSuggestions();

    publishDiagnosticState(
      'unavailable',
      detail
    );

    setState('unavailable');
  };

  window[GOOGLE_READY_CALLBACK] =
    settleLoaded;

  const previousAuthFailure =
    window.gm_authFailure;

  window.gm_authFailure = () => {
    try {
      if (
        typeof previousAuthFailure
        === 'function'
      ) {
        previousAuthFailure();
      }
    } finally {
      settleUnavailable(
        'Google rejected the API key, referrer, billing account, or enabled API configuration.'
      );
    }
  };

  const query = [
    `key=${encodeURIComponent(apiKey)}`,
    'loading=async',
    'libraries=places',
    'auth_referrer_policy=origin',
    `callback=${encodeURIComponent(
      GOOGLE_READY_CALLBACK
    )}`,
    'v=weekly'
  ].join('&');

  script.src =
    `https://maps.googleapis.com/maps/api/js?${query}`;

  script.async = true;
  script.defer = true;

  script.referrerPolicy =
    'strict-origin-when-cross-origin';

  script.dataset.googlePlacesLoader =
    'true';

  loadTimeout = window.setTimeout(
    () => settleUnavailable(
      'Google Maps JavaScript API timed out.'
    ),
    SCRIPT_LOAD_TIMEOUT_MS
  );

  script.addEventListener(
    'error',
    () => settleUnavailable(
      'Google Maps JavaScript API network load failed.'
    ),
    {
      once: true
    }
  );

  document.head.appendChild(script);
})();
