/* 408-UI-4.6 — Local Community Convergence presentation runtime.
   Category proxies forward to the existing Local directory filters. No catalog or attribution logic changes. */
(function(root){
  'use strict';
  function syncProxyState(doc){
    var native=Array.prototype.find.call(doc.querySelectorAll('[data-local-filter]'),function(b){return b.getAttribute('aria-pressed')==='true';});
    var active=native ? native.getAttribute('data-local-filter') : 'all';
    doc.querySelectorAll('[data-ui46-local-filter]').forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-ui46-local-filter')===active?'true':'false');});
  }
  function bindDirectory(doc){
    var rootEl=doc.querySelector('[data-local-directory]');
    if(!rootEl) return;
    doc.querySelectorAll('[data-ui46-local-filter]').forEach(function(button){
      button.addEventListener('click',function(){
        var key=button.getAttribute('data-ui46-local-filter')||'all';
        var native=rootEl.querySelector('[data-local-filter="'+key+'"]');
        if(native) native.click();
        syncProxyState(doc);
        var dir=doc.getElementById('directory');
        if(dir) dir.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
      });
    });
    var observer=new MutationObserver(function(){syncProxyState(doc);});
    rootEl.querySelectorAll('[data-local-filter]').forEach(function(b){observer.observe(b,{attributes:true,attributeFilter:['aria-pressed','class']});});
    syncProxyState(doc);
  }
  function markDetail(doc){
    var rootEl=doc.querySelector('[data-local-merchant-detail]');
    if(!rootEl) return;
    var apply=function(){
      if(rootEl.getAttribute('data-local-detail-state')==='ready') rootEl.classList.add('ui46-local-detail-ready');
    };
    new MutationObserver(apply).observe(rootEl,{childList:true,subtree:true,attributes:true,attributeFilter:['data-local-detail-state']});
    apply();
  }
  function init(doc){bindDirectory(doc);markDetail(doc);}
  if(typeof document!=='undefined'){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){init(document);},{once:true}); else init(document);
  }
  root.LocalCommunityEditorial=Object.freeze({init:init,syncProxyState:syncProxyState});
})(typeof globalThis!=='undefined'?globalThis:this);
