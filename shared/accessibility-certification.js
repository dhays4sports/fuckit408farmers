/* 408-UI-3.11 — Accessibility Certification runtime semantics.
   Does not prevent native validation or alter form submission/routing behavior. */
(function(window,document){
  'use strict';
  var body=document.body;
  if(body) body.dataset.uiAccessibility='408-UI-3.11';

  /* Reflect native validity in aria-invalid without suppressing browser validation. */
  document.addEventListener('invalid',function(event){
    var control=event.target;
    if(control && control.matches && control.matches('input,select,textarea')){
      control.setAttribute('aria-invalid','true');
    }
  },true);
  function clearValidityState(event){
    var control=event.target;
    if(!control || !control.matches || !control.matches('input,select,textarea')) return;
    if(typeof control.checkValidity==='function' && control.checkValidity()) control.removeAttribute('aria-invalid');
  }
  document.addEventListener('input',clearValidityState,true);
  document.addEventListener('change',clearValidityState,true);

  /* Status updates should be announced as a complete message, not fragment-by-fragment. */
  document.querySelectorAll('[role="status"],[aria-live]').forEach(function(region){
    if(!region.hasAttribute('aria-atomic')) region.setAttribute('aria-atomic','true');
  });

  /* If Escape closes the mobile navigation while focus is inside it, return focus to the trigger. */
  document.addEventListener('keydown',function(event){
    if(event.key!=='Escape') return;
    var toggle=document.querySelector('.ui3-menu-toggle[aria-expanded="true"]');
    if(!toggle) return;
    var nav=document.getElementById(toggle.getAttribute('aria-controls')||'');
    if(nav && nav.contains(document.activeElement)){
      window.setTimeout(function(){try{toggle.focus({preventScroll:true});}catch(_){toggle.focus();}},0);
    }
  },true);
})(window,document);
