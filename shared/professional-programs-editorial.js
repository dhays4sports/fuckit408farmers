/* 408-UI-4.5 — approved profession-title accent renderer.
   Presentation only. Campaign copy remains authoritative. */
(function(){
  'use strict';
  var map={
    healthcare:{full:'Work in Healthcare?',prefix:'Work in ',accent:'Healthcare?'},
    teachers:{full:'Are You a Teacher?',prefix:'Are You a ',accent:'Teacher?'},
    tech:{full:'Work in Tech?',prefix:'Work in ',accent:'Tech?'},
    engineers:{full:'Are You an Engineer?',prefix:'Are You an ',accent:'Engineer?'}
  };
  function paint(){
    var b=document.body;if(!b||!b.classList.contains('ui45-professional-editorial')) return;
    var cfg=map[b.dataset.professionalProgram||''];
    var h=document.querySelector('[data-campaign-entry-title]');
    if(!cfg||!h||h.textContent.trim()!==cfg.full) return;
    h.textContent='';
    h.appendChild(document.createTextNode(cfg.prefix));
    var s=document.createElement('span');s.className='ui45-title-accent';s.textContent=cfg.accent;h.appendChild(s);
  }
  document.addEventListener('408farmers:campaign-entry-matched',paint);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',paint,{once:true}); else paint();
})();
