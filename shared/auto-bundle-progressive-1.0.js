/* 408-BUNDLE-1.0 — tap-first household context and minimum fallback identity. */
(function(window,document){
  'use strict';
  var form=document.querySelector('form[data-auto-bundle-progressive="true"]');
  if(!form)return;
  var HOUSING_KEYS=new Set(['homeowner','renter']);
  var STATUS_KEYS=new Set(['both','home_only','auto_only','neither','not_sure']);
  var steps={housing:form.querySelector('[data-bundle-step="housing"]'),coverage:form.querySelector('[data-bundle-step="coverage"]'),capture:form.querySelector('[data-bundle-step="capture"]')};
  var progress=Array.from(form.querySelectorAll('[data-bundle-progress]'));
  var status=document.getElementById('formStatus');
  var current='housing';
  function safeEvent(name,detail){
    var payload=Object.assign({event:name,funnel:'auto_bundle_pvx',route:'/auto-bundle/'},detail||{});
    window.dataLayer=window.dataLayer||[];window.dataLayer.push(payload);
    try{document.dispatchEvent(new CustomEvent('408farmers:'+name,{detail:payload}));}catch(_){}
  }
  function show(name,focus){
    current=name;Object.keys(steps).forEach(function(key){steps[key].hidden=key!==name;});
    var order=['housing','coverage','capture'],index=order.indexOf(name);
    progress.forEach(function(node,i){node.classList.toggle('is-current',i===index);node.classList.toggle('is-complete',i<index);});
    if(focus){var target=steps[name].querySelector('legend,button,input');if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}}
  }
  form.querySelectorAll('[data-bundle-housing]').forEach(function(button){
    button.setAttribute('aria-pressed','false');
    button.addEventListener('click',function(){
      var value=button.dataset.bundleHousing;if(!HOUSING_KEYS.has(value))return;
      form.querySelectorAll('[data-bundle-housing]').forEach(function(item){item.setAttribute('aria-pressed',String(item.dataset.bundleHousing===value));});
      form.elements.housing_context.value=value;
      safeEvent('housing_selected',{housing_context:value});
      show('coverage',true);
    });
  });
  form.querySelectorAll('[data-bundle-status]').forEach(function(button){
    button.setAttribute('aria-pressed','false');
    button.addEventListener('click',function(){
      var value=button.dataset.bundleStatus;if(!STATUS_KEYS.has(value))return;
      form.querySelectorAll('[data-bundle-status]').forEach(function(item){item.setAttribute('aria-pressed',String(item.dataset.bundleStatus===value));});
      form.elements.bundle_status.value=value;
      safeEvent('bundle_status_selected',{bundle_status:value});
      safeEvent('early_capture_presented',{checkpoint:'minimum_identity'});
      show('capture',true);
    });
  });
  form.querySelectorAll('[data-bundle-back]').forEach(function(button){button.addEventListener('click',function(){show(button.dataset.bundleBack==='coverage'?'coverage':'housing',true);});});
  var skip=form.querySelector('[data-continue-without-saving]');
  skip.addEventListener('click',function(){
    if(!HOUSING_KEYS.has(form.elements.housing_context.value)||!STATUS_KEYS.has(form.elements.bundle_status.value)){status.textContent='Choose your housing and current coverage first.';return;}
    skip.disabled=true;safeEvent('early_capture_skipped',{housing_context:form.elements.housing_context.value,bundle_status:form.elements.bundle_status.value});
    document.dispatchEvent(new CustomEvent('408farmers:continue-without-saving',{detail:{source:'auto_bundle_progressive_capture'}}));
  });
  window.addEventListener('pageshow',function(event){if(event.persisted){skip.disabled=false;status.textContent='';show(current,false);}});
  safeEvent('landing_viewed',{campaign_id:new URLSearchParams(location.search).get('campaign_id')||''});
})(window,document);
