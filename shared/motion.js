(function(){
  const root=document.documentElement;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.cf-stagger').forEach((group)=>{
    [...group.children].forEach((child,index)=>child.style.setProperty('--cf-stagger-index',index));
  });

  const chips=document.querySelector('.score-chips.cf-stagger');
  if(chips){window.setTimeout(()=>chips.classList.add('is-sequenced'),reduced?0:520);}

  const timeline=document.querySelector('[data-timeline]');
  if(timeline){
    if(reduced || !('IntersectionObserver' in window)) timeline.classList.add('is-active');
    else {
      const observer=new IntersectionObserver((entries)=>{
        entries.forEach((entry)=>{if(entry.isIntersecting){entry.target.classList.add('is-active');observer.unobserve(entry.target);}});
      },{threshold:.22});
      observer.observe(timeline);
    }
  }

  let ticking=false;
  function updateScroll(){
    ticking=false;
    const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
    const progress=Math.min(1,Math.max(0,window.scrollY/max));
    root.style.setProperty('--cf-scroll-progress',progress.toFixed(4));
    if(!reduced && window.innerWidth>980){
      const heroHeight=document.querySelector('.score-hero')?.offsetHeight || window.innerHeight;
      const local=Math.min(1,Math.max(0,window.scrollY/heroHeight));
      root.style.setProperty('--cf-hero-shift',`${(-local*34).toFixed(1)}px`);
      root.style.setProperty('--cf-visual-shift',`${(local*24).toFixed(1)}px`);
      root.style.setProperty('--cf-hero-scale',(1-local*.055).toFixed(4));
    }
  }
  function requestUpdate(){if(!ticking){ticking=true;requestAnimationFrame(updateScroll);}}
  updateScroll();
  addEventListener('scroll',requestUpdate,{passive:true});
  addEventListener('resize',requestUpdate,{passive:true});

  document.querySelectorAll('.cf-btn').forEach((button)=>{
    button.addEventListener('pointerdown',(event)=>{
      if(reduced) return;
      const rect=button.getBoundingClientRect();
      const size=Math.max(rect.width,rect.height);
      const ripple=document.createElement('span');
      ripple.className='cf-ripple';
      ripple.style.width=ripple.style.height=`${size}px`;
      ripple.style.left=`${event.clientX-rect.left-size/2}px`;
      ripple.style.top=`${event.clientY-rect.top-size/2}px`;
      button.appendChild(ripple);
      ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
    });
  });
})();
