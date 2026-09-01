(function(){
  const overlay=document.getElementById('reviewTransition');
  const fallbackDestination='/home#form';
  let navigating=false;

  function launchCoverageFit(){
    if(window.CoverageFitLauncher && typeof window.CoverageFitLauncher.launch==='function'){
      return window.CoverageFitLauncher.launch({
        entry:'score',
        assessment:'home',
        source:'408farmers',
        fallbackUrl:fallbackDestination,
        next:'/assessment/',
        extra:{launch_surface:'home_protection_score'}
      });
    }

    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push({
      event:'coveragefit_launch_fallback',
      entry:'score',
      assessment:'home',
      fallback:fallbackDestination,
      reason:'launcher_unavailable'
    });
    window.location.assign(fallbackDestination);
    return fallbackDestination;
  }

  document.querySelectorAll('.js-start-review').forEach((button)=>{
    button.addEventListener('click',()=>{
      if(navigating) return;
      navigating=true;
      button.setAttribute('aria-busy','true');

      if(overlay){
        overlay.classList.add('is-active');
        overlay.setAttribute('aria-hidden','false');
        document.body.style.overflow='hidden';
      }

      window.setTimeout(launchCoverageFit,1450);
    });
  });

  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals=[...document.querySelectorAll('.reveal')];
  if(!reduced && 'IntersectionObserver' in window){
    const observer=new IntersectionObserver((entries)=>{
      entries.forEach((entry)=>{
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },{threshold:.14,rootMargin:'0px 0px -40px'});
    reveals.forEach((el)=>observer.observe(el));
  }else{
    reveals.forEach((el)=>el.classList.add('is-visible'));
  }

  const mobileCta=document.querySelector('.mobile-cta');
  const heroButton=document.querySelector('.score-copy .score-primary');
  const mobileButton=mobileCta?.querySelector('button');
  function setMobileCtaShown(shown){
    if(!mobileCta) return;
    const hidden=!shown;
    mobileCta.classList.toggle('is-visible',shown);
    mobileCta.setAttribute('aria-hidden',hidden?'true':'false');
    if(mobileButton){
      mobileButton.disabled=hidden;
      if(hidden) mobileButton.setAttribute('tabindex','-1');
      else mobileButton.removeAttribute('tabindex');
    }
  }
  setMobileCtaShown(false);
  if(mobileCta && heroButton && 'IntersectionObserver' in window){
    const ctaObserver=new IntersectionObserver((entries)=>{
      const visible=entries[0] && entries[0].isIntersecting;
      setMobileCtaShown(!visible);
    },{threshold:.1});
    ctaObserver.observe(heroButton);
  }
})();
