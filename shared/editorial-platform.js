/* 408-UI-4.1 — Editorial Platform Foundation runtime.
   Non-Life only. Adds presentation metadata and refines shared navigation/contact chrome.
   Does not alter forms, submission, attribution, routing, or CoverageFit contracts. */
(function(){
  'use strict';
  function routeKey(){
    var p=(location.pathname||'/').replace(/\/+$/,'')||'/';
    if(/^\/(healthcare|teachers|tech|engineers)/.test(p)) return 'professionals';
    return '';
  }
  function run(){
    var d=document, body=d.body;
    if(!body || body.classList.contains('life-page') || location.pathname.indexOf('/life')===0) return;
    body.classList.add('ui4-page');
    body.dataset.uiEditorialFoundation='408-UI-4.1';

    var nav=d.querySelector('.ui3-primary-nav');
    if(nav){
      var local=Array.prototype.find.call(nav.querySelectorAll('a'),function(a){return (a.getAttribute('href')||'').indexOf('/local')===0;});
      var professional=nav.querySelector('a[data-ui4-professionals]');
      if(!professional){
        professional=d.createElement('a');
        professional.href='/healthcare/';
        professional.textContent='Professionals';
        professional.dataset.ui4Professionals='true';
        if(local) nav.insertBefore(professional,local); else nav.appendChild(professional);
      }
      if(routeKey()==='professionals') professional.setAttribute('aria-current','page');
    }

    var header=d.querySelector('.ui3-site-header');
    var legacyCall=header && header.querySelector('.ui3-header-call');
    if(header && !header.querySelector('.ui4-header-contact')){
      var wrap=d.createElement('div');
      wrap.className='ui4-header-contact';
      wrap.setAttribute('aria-label','Text or call Dylan');
      wrap.innerHTML='<span class="ui4-header-contact__label"><span>Text or Call Dylan</span><strong>408-FARMERS</strong></span><span class="ui4-header-contact__actions"><a href="sms:+14083276377" aria-label="Text Dylan at 408-327-6377">Text</a><a href="tel:+14083276377" aria-label="Call Dylan at 408-327-6377">(408) 327-6377</a></span>';
      if(legacyCall) header.insertBefore(wrap,legacyCall); else header.appendChild(wrap);
    }

    var mobileCall=nav && nav.querySelector('.ui3-mobile-call');
    if(mobileCall && !nav.querySelector('.ui4-mobile-text')){
      var mobileText=d.createElement('a');
      mobileText.href='sms:+14083276377';
      mobileText.className='ui4-mobile-text';
      mobileText.textContent='Text Dylan · 408-FARMERS';
      mobileCall.parentNode.insertBefore(mobileText,mobileCall);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
})();
