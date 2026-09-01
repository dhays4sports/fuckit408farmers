(function (window, document) {
  'use strict';

  var DEFAULTS = {
    bootstrapUrl: 'https://coveragefit.com/api/pvx/web-bootstrap',
    baseUrl: 'https://coveragefit.com/transition/',
    source: '408farmers', assessment: 'home', fallbackUrl: '/home#form',
    sessionStorageKey: 'cf_integration_session_id', bootstrapStorageKey: '408farmers_pvx_bootstrap_id_v1',
    campaignStorageKey: 'cf_campaign', utmStorageKey: 'cf_utm_attribution'
  };
  var PASSTHROUGH_KEYS = ['source','partner_id','perk_id','merchant_slug','surface','variant','campaign','campaign_id','campaign_variant','campaign_zip','utm_source','utm_medium','utm_campaign','utm_term','utm_content','creative','ref','referral'];
  var SAFE_EXTRA_KEYS = new Set(['launch_surface','lead_captured','lead_capture_status','sender_build','handoff_contract','handoff_version','contact_consent','consent_at','consent_version','automated_marketing_sms_consent','automated_marketing_sms_consent_version','automated_marketing_sms_consent_timestamp','submitted_at','professional_program','professional_role','professional_role_label']);
  var SHOPPING_REASON = { farmers_fit:'renewal_increase', coverage_fit:'something_else', home_auto_bundle:'something_else', exploring:'comparison' };
  var IMPROVEMENT = { shopping_now:'understanding', renewal_60:'claim_support', later:'agent_access', coordination:'coordination', price_only:'price_only', not_sure:'not_sure' };

  function clean(value, max) { return String(value == null ? '' : value).trim().replace(/[<>\u0000-\u001f\u007f]/g, '').slice(0, max || 240); }
  function safeStorage(type) { try { var storage=window[type],key='__cf_storage_test__';storage.setItem(key,'1');storage.removeItem(key);return storage; } catch (_) { return null; } }
  function randomId(prefix) { if (window.crypto && typeof window.crypto.randomUUID === 'function') return prefix + window.crypto.randomUUID().replace(/-/g,'').slice(0,32);return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,18); }
  function durableId(key, prefix) { var session=safeStorage('sessionStorage'),local=safeStorage('localStorage'),value=(session&&session.getItem(key))||(local&&local.getItem(key));if(value)return value;value=randomId(prefix);try{session&&session.setItem(key,value);local&&local.setItem(key,value);}catch(_){}return value; }
  function getSessionId() { return durableId(DEFAULTS.sessionStorageKey,'cfs_'); }
  function getBootstrapId() { return durableId(DEFAULTS.bootstrapStorageKey,'pvxb_'); }
  function getStoredJson(storage,key){if(!storage)return{};try{return JSON.parse(storage.getItem(key)||'{}')||{};}catch(_){return{};}}
  function currentQuery(){try{return new URLSearchParams(window.location.search||'');}catch(_){return new URLSearchParams('');}}

  function getAttribution() {
    var query=currentQuery(),local=safeStorage('localStorage'),stored=getStoredJson(local,DEFAULTS.utmStorageKey),out={},explicit={};
    PASSTHROUGH_KEYS.forEach(function(key){var value=query.get(key)||stored[key]||'';if(value)out[key]=clean(value,key==='campaign_id'?180:160);if(query.get(key))explicit[key]=out[key];});
    if(!Object.keys(explicit).length&&local){try{var record=JSON.parse(local.getItem('408farmers_local_attribution_v1')||'null');if(record&&record.schema_version==='408-local-attribution-v1'&&Number(record.expires_at)>Date.now()&&record.context?.source==='local'){PASSTHROUGH_KEYS.forEach(function(key){if(!out[key]&&record.context[key])out[key]=clean(record.context[key],160);});}}catch(_){}}
    if(!out.campaign)out.campaign=(window.CFCampaign&&window.CFCampaign.current)||(local&&local.getItem(DEFAULTS.campaignStorageKey))||'direct';
    if(window.Farmers408FlyerCampaign&&typeof window.Farmers408FlyerCampaign.apply==='function')out=window.Farmers408FlyerCampaign.apply(out);
    if(local&&Object.keys(explicit).length){try{local.setItem(DEFAULTS.utmStorageKey,JSON.stringify(Object.assign({},stored,explicit)));}catch(_){}}
    return out;
  }

  function normalizeEntry(entry){var value=clean(entry||window.location.pathname,80).replace(/^\/+|\/+$/g,'').toLowerCase();if(/buyer/.test(value))return'buyer';if(/auto[_-]?bundle|home[_-]?auto/.test(value))return'home_auto';if(/^auto$|auto_lander/.test(value))return'auto';if(/tech|teacher|healthcare|engineer|professional/.test(value))return'professional';if(/neighbor/.test(value))return'neighbor';if(/home/.test(value))return'home';return value||'homepage';}
  function getConfig(options){var site=window.LANDING_PAGE_CONFIG||{},input=options||{};return{bootstrapUrl:input.bootstrapUrl||site.coverageFitBootstrapUrl||DEFAULTS.bootstrapUrl,baseUrl:input.baseUrl||site.coverageFitTransitionUrl||DEFAULTS.baseUrl,source:input.source||DEFAULTS.source,assessment:input.assessment||DEFAULTS.assessment,fallbackUrl:input.fallbackUrl||site.coverageFitFallbackUrl||DEFAULTS.fallbackUrl,entry:normalizeEntry(input.entry),campaign:input.campaign||null,extra:input.extra||{},profile:input.profile||null,next:input.next||null};}
  function productTrack(config,profile){var housing=clean(profile?.housingContext,40).toLowerCase();if(housing==='renter')return'renter';if(housing==='buyer'||config.entry==='buyer')return'buyer';if(config.entry==='home_auto'||profile?.homeReviewGoal==='home_auto_bundle')return'bundle';if(config.entry==='auto'||config.assessment==='auto')return'auto';return'home';}
  function customerSelection(track){return track==='buyer'?'buying_home':track==='renter'?'renter':track==='bundle'?'review_home_auto':track==='auto'?'start_snapshot':'review_owned_home';}
  function discoverySeed(profile){var shopping=SHOPPING_REASON[clean(profile?.homeReviewGoal,40)]||'',priority=IMPROVEMENT[clean(profile?.reviewTiming,40)]||'';if(clean(profile?.housingContext,40)==='buyer')shopping='buying_home';return{shoppingReason:shopping,improvementPriorities:priority?[priority]:[],shoppingWords:clean(profile?.reviewContext,240)};}
  function bool(value){return value===true||String(value).toLowerCase()==='true';}

  function buildPayload(options) {
    var config=getConfig(options),profile=config.profile||{},attribution=getAttribution(),extra=config.extra||{},track=productTrack(config,profile),discovery=discoverySeed(profile);
    var leadConfirmed=extra.lead_capture_status==='confirmed'&&bool(extra.contact_consent)&&profile?.contactPermission?.confirmed===true;
    var marketingSms=leadConfirmed&&bool(extra.automated_marketing_sms_consent)&&profile?.contactPermission?.automatedMarketingSms?.granted===true&&Boolean(clean(extra.automated_marketing_sms_consent_version||profile?.contactPermission?.automatedMarketingSms?.version,100))&&Boolean(clean(extra.automated_marketing_sms_consent_timestamp||profile?.contactPermission?.automatedMarketingSms?.capturedAt,40));
    var payload={
      bootstrap_id:getBootstrapId(),entry_type:config.entry,route_path:window.location.pathname||'/',host_mode:'408farmers',source:attribution.source==='local'?'local':config.source,
      customer_selection:customerSelection(track),product_track:track,campaign:config.campaign||attribution.campaign||'direct',campaign_id:attribution.campaign_id||profile.campaignId||'',campaign_variant:attribution.campaign_variant||profile.campaignVariant||'',campaign_zip:attribution.campaign_zip||profile.campaignZip||'',creative:attribution.creative||'',
      utm_source:attribution.utm_source||profile.utm?.source||'',utm_medium:attribution.utm_medium||profile.utm?.medium||'',utm_campaign:attribution.utm_campaign||profile.utm?.campaign||'',utm_content:attribution.utm_content||profile.utm?.content||'',utm_term:attribution.utm_term||profile.utm?.term||'',
      partner_id:attribution.partner_id||profile.partnerId||'',referral_source:profile.referralSource||'',
      discovery_shopping_reason:discovery.shoppingReason,discovery_improvement_priorities:discovery.improvementPriorities.join(','),discovery_shopping_words:discovery.shoppingWords,
      lead_capture_status:leadConfirmed?'confirmed':extra.lead_capture_status==='skipped'?'skipped':'not_confirmed',contact_consent:leadConfirmed?'true':'false',
      first_name:leadConfirmed?clean(profile.firstName,80):'',phone:leadConfirmed?clean(profile.phone,40):'',lead_checkpoint_id:leadConfirmed?clean(profile.leadCheckpointId||profile.integration?.leadCheckpointId,120):'',
      consent_at:leadConfirmed?clean(extra.consent_at||profile.contactPermission?.capturedAt,40):'',consent_version:leadConfirmed?clean(extra.consent_version||profile.contactPermission?.version,80):'',
      automated_marketing_sms_consent:marketingSms?'true':'false',automated_marketing_sms_consent_version:marketingSms?clean(extra.automated_marketing_sms_consent_version||profile?.contactPermission?.automatedMarketingSms?.version,100):'',automated_marketing_sms_consent_timestamp:marketingSms?clean(extra.automated_marketing_sms_consent_timestamp||profile?.contactPermission?.automatedMarketingSms?.capturedAt,40):''
    };
    if(track==='buyer'){payload.closing_date=clean(profile.closingDate,40);payload.occupancy=clean(profile.occupancy,40);}
    if(track==='bundle')payload.bundle_status=clean(profile.bundleStatus,60);
    ['professional_program','professional_role','professional_role_label'].forEach(function(key){if(extra[key])payload[key]=clean(extra[key],key==='professional_role_label'?120:60);});
    return Object.fromEntries(Object.entries(payload).filter(function(pair){return pair[1]!==''&&pair[1]!=null;}));
  }

  function buildUrl(options){var config=getConfig(options),attribution=getAttribution(),url=new URL(config.baseUrl,window.location.origin);url.searchParams.set('source',attribution.source==='local'?'local':config.source);url.searchParams.set('entry',config.entry);url.searchParams.set('assessment',config.assessment);url.searchParams.set('campaign',config.campaign||attribution.campaign||'direct');return url.toString();}
  function appendProfileParams(){return false;}
  function emitLaunchEvent(endpoint,options,payload){var config=getConfig(options),detail={event:'coveragefit_assessment_launch',destination:new URL(endpoint,window.location.origin).origin+new URL(endpoint,window.location.origin).pathname,campaign:payload.campaign||'direct',source:payload.source||config.source,entry:config.entry,assessment:config.assessment,product_track:payload.product_track,secure_post:true,session_id:getSessionId()};window.dataLayer=window.dataLayer||[];window.dataLayer.push(detail);if(typeof window.CustomEvent==='function')document.dispatchEvent(new window.CustomEvent('coveragefit:launch',{detail:detail}));return detail;}
  function submitSecure(endpoint,payload){var form=document.createElement('form');form.method='POST';form.action=endpoint;form.acceptCharset='UTF-8';form.hidden=true;Object.keys(payload).forEach(function(name){var input=document.createElement('input');input.type='hidden';input.name=name;input.value=String(payload[name]);form.appendChild(input);});document.body.appendChild(form);form.submit();}

  function launch(options) {
    var config=getConfig(options),payload=buildPayload(options),endpoint=config.bootstrapUrl;
    try{new URL(endpoint,window.location.origin);emitLaunchEvent(endpoint,options,payload);if(options?.profile&&typeof window.CustomEvent==='function')document.dispatchEvent(new window.CustomEvent('coveragefit:profile-ready',{detail:{knownIdentity:Boolean(payload.first_name&&payload.phone),productTrack:payload.product_track}}));if(!options||options.navigate!==false)submitSecure(endpoint,payload);return endpoint;}catch(error){window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'coveragefit_launch_fallback',entry:config.entry,assessment:config.assessment,fallback:config.fallbackUrl,reason:clean(error.message,120)});if(!options||options.navigate!==false)window.location.assign(config.fallbackUrl);return config.fallbackUrl;}
  }
  function parseExtra(element){var extra={};if(!element?.dataset)return extra;Object.keys(element.dataset).forEach(function(key){if(!key.startsWith('cfExtra'))return;var suffix=key.slice(7);if(!suffix)return;var param=(suffix.charAt(0).toLowerCase()+suffix.slice(1)).replace(/[A-Z]/g,function(match){return'_'+match.toLowerCase();});if(SAFE_EXTRA_KEYS.has(param))extra[param]=element.dataset[key];});return extra;}
  function bindLaunchElements(rootElement){var scope=rootElement||document,elements=scope.querySelectorAll('[data-coveragefit-launch]');elements.forEach(function(element){if(element.dataset.coveragefitBound==='true')return;element.dataset.coveragefitBound='true';element.addEventListener('click',function(event){event.preventDefault();launch({entry:element.dataset.cfEntry||null,assessment:element.dataset.cfAssessment||DEFAULTS.assessment,campaign:element.dataset.cfCampaign||null,fallbackUrl:element.dataset.cfFallback||null,next:element.dataset.cfNext||null,extra:parseExtra(element)});});});return elements.length;}

  window.CoverageFitLauncher={version:'2.0.0',build:'408-DISCOVERY-1.0',buildUrl:buildUrl,buildPayload:buildPayload,launch:launch,getSessionId:getSessionId,getBootstrapId:getBootstrapId,getAttribution:getAttribution,bindLaunchElements:bindLaunchElements,appendProfileParams:appendProfileParams,defaults:Object.assign({},DEFAULTS)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){bindLaunchElements(document);});else bindLaunchElements(document);
})(window, document);
