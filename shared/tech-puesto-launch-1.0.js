/* TECH-PUESTO-LAUNCH-1.0 — bounded tap-first role/housing capture and privacy-safe funnel events. */
(function(window,document){
  'use strict';
  var form=document.querySelector('form[data-tech-progressive="true"]');
  if(!form)return;
  var ROLE_KEYS=new Set(['software_engineering','it_cybersecurity','data_analytics','product_program','design_ux','tech_operations_support','other_tech']);
  var HOUSING_KEYS=new Set(['homeowner','renter']);
  var steps={role:form.querySelector('[data-tech-step="role"]'),housing:form.querySelector('[data-tech-step="housing"]'),capture:form.querySelector('[data-tech-step="capture"]')};
  var progress=Array.from(form.querySelectorAll('[data-tech-progress]'));
  var status=document.getElementById('formStatus');
  var current='role';
  function safeEvent(name,detail){
    var payload=Object.assign({event:name,funnel:'tech_pvx',route:'/tech/'},detail||{});
    window.dataLayer=window.dataLayer||[];window.dataLayer.push(payload);
    try{document.dispatchEvent(new CustomEvent('408farmers:'+name,{detail:payload}));}catch(_){}
  }
  function show(name,focus){
    current=name;Object.keys(steps).forEach(function(key){steps[key].hidden=key!==name;});
    var order=['role','housing','capture'],index=order.indexOf(name);
    progress.forEach(function(node,i){node.classList.toggle('is-current',i===index);node.classList.toggle('is-complete',i<index);});
    if(focus){var target=steps[name].querySelector('legend,button,input');if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}}
  }
  function choose(selector,value,label){
    form.querySelectorAll(selector).forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.techRole===value||button.dataset.techHousing===value));});
    if(label){form.elements.professional_role.value=value;form.elements.professional_role_label.value=label;form.elements.occupation_segment.value=label;safeEvent('role_selected',{professional_role:value});show('housing',true);}
    else{form.elements.housing_context.value=value;safeEvent('housing_selected',{housing_context:value});safeEvent('early_capture_presented',{checkpoint:'minimum_identity'});show('capture',true);}
  }
  form.querySelectorAll('[data-tech-role]').forEach(function(button){button.setAttribute('aria-pressed','false');button.addEventListener('click',function(){var value=button.dataset.techRole,label=String(button.dataset.techRoleLabel||'').slice(0,120);if(ROLE_KEYS.has(value)&&label)choose('[data-tech-role]',value,label);});});
  form.querySelectorAll('[data-tech-housing]').forEach(function(button){button.setAttribute('aria-pressed','false');button.addEventListener('click',function(){var value=button.dataset.techHousing;if(HOUSING_KEYS.has(value))choose('[data-tech-housing]',value,'');});});
  form.querySelectorAll('[data-tech-back]').forEach(function(button){button.addEventListener('click',function(){show(button.dataset.techBack==='housing'?'housing':'role',true);});});
  var skip=form.querySelector('[data-continue-without-saving]');
  skip.addEventListener('click',function(){
    if(!ROLE_KEYS.has(form.elements.professional_role.value)||!HOUSING_KEYS.has(form.elements.housing_context.value)){status.textContent='Choose your role and whether you own or rent first.';return;}
    skip.disabled=true;safeEvent('early_capture_skipped',{housing_context:form.elements.housing_context.value,professional_role:form.elements.professional_role.value});
    document.dispatchEvent(new CustomEvent('408farmers:continue-without-saving',{detail:{source:'tech_progressive_capture'}}));
  });
  window.addEventListener('pageshow',function(event){if(event.persisted){skip.disabled=false;status.textContent='';show(current,false);}});
  safeEvent('landing_viewed',{campaign_id:new URLSearchParams(location.search).get('campaign_id')||''});
})(window,document);
