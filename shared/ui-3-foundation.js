/* 408-UI-3.1 — Unified Visual Foundation runtime enhancement.
   Does not alter form names, destinations, submission endpoints, attribution values, or CoverageFit contracts. */
(function(){
  'use strict';
  var d=document;
  var body=d.body;
  if(!body) return;
  body.classList.add('ui3-page');
  body.dataset.uiFoundation='408-UI-3.1';

  function routeKey(){
    var p=(location.pathname||'/').replace(/\/+$/,'')||'/';
    if(p==='/') return 'home';
    if(p.indexOf('/auto-bundle')===0) return 'auto';
    if(p.indexOf('/buyer')===0) return 'buyers';
    if(p.indexOf('/local')===0) return 'local';
    if(p.indexOf('/life')===0) return 'life';
    if(p.indexOf('/contact')===0) return 'contact';
    if(/^\/(healthcare|teachers|tech|engineers)/.test(p)) return 'professionals';
    return '';
  }

  function enhanceHeader(){
    var header=d.querySelector('header.site-header,header.buyer-header,header.life-header,header.contact-choice-header,header.root-header');
    if(!header){
      header=d.createElement('header');
      var skip=d.querySelector('.skip-link');
      if(skip && skip.nextSibling){skip.parentNode.insertBefore(header,skip.nextSibling);}else{body.insertBefore(header,body.firstChild);}
    }
    if(header.dataset.ui3Enhanced==='true') return;
    header.dataset.ui3Enhanced='true';
    header.classList.add('ui3-site-header');

    var brand=header.querySelector('a.brand,a.buyer-brand,a.life-brand');
    if(!brand){
      brand=d.createElement('a');
      brand.href='/';
      brand.className='brand';
      header.insertBefore(brand,header.firstChild);
    }
    brand.classList.add('ui3-brand');
    brand.href='/';
    brand.setAttribute('aria-label','408FARMERS home');
    brand.innerHTML='<img src="/shared/assets/408-farmers-nav-logo.png" alt="408FARMERS Insurance Text Line" width="506" height="107" decoding="async">';

    var oldNavs=header.querySelectorAll('.root-nav,.local-nav');
    oldNavs.forEach(function(n){n.hidden=true;n.setAttribute('aria-hidden','true');});

    var nav=d.createElement('nav');
    nav.id='ui3-primary-nav';
    nav.className='ui3-primary-nav';
    nav.setAttribute('aria-label','Primary navigation');
    var items=[
      ['home','Home','/'],
      ['auto','Home + Auto','/auto-bundle/'],
      ['buyers','Buyers','/buyer/'],
      ['local','Local','/local/'],
      ['life','Life','/life/'],
      ['contact','Contact','/contact/']
    ];
    var active=routeKey();
    items.forEach(function(item){
      var a=d.createElement('a');
      a.href=item[2];a.textContent=item[1];
      if(active===item[0]) a.setAttribute('aria-current','page');
      nav.appendChild(a);
    });
    var mobileCall=d.createElement('a');
    mobileCall.href='tel:+14083276377';
    mobileCall.className='ui3-mobile-call';
    mobileCall.textContent='Call Dylan · (408) 327-6377';
    nav.appendChild(mobileCall);

    var toggle=d.createElement('button');
    toggle.type='button';
    toggle.className='ui3-menu-toggle';
    toggle.setAttribute('aria-controls',nav.id);
    toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-label','Open navigation');
    toggle.innerHTML='<span></span>';

    var call=d.createElement('a');
    call.href='tel:+14083276377';
    call.className='ui3-header-call';
    call.textContent='Call Dylan';
    call.setAttribute('aria-label','Call Dylan at 408-327-6377');

    header.appendChild(nav);
    header.appendChild(toggle);
    header.appendChild(call);

    function closeMenu(){
      header.dataset.menuOpen='false';
      toggle.setAttribute('aria-expanded','false');
      toggle.setAttribute('aria-label','Open navigation');
      body.classList.remove('ui3-menu-locked');
    }
    toggle.addEventListener('click',function(){
      var open=header.dataset.menuOpen==='true';
      header.dataset.menuOpen=open?'false':'true';
      toggle.setAttribute('aria-expanded',open?'false':'true');
      toggle.setAttribute('aria-label',open?'Open navigation':'Close navigation');
      body.classList.toggle('ui3-menu-locked',!open);
    });
    nav.addEventListener('click',function(e){if(e.target.closest('a')) closeMenu();});
    d.addEventListener('keydown',function(e){if(e.key==='Escape') closeMenu();});
    window.addEventListener('resize',function(){if(window.innerWidth>860) closeMenu();},{passive:true});
  }

  function enhanceFooter(){
    var footer=d.querySelector('footer');
    if(!footer){footer=d.createElement('footer');body.appendChild(footer);}
    if(footer.dataset.ui3Enhanced==='true') return;
    footer.dataset.ui3Enhanced='true';
    footer.className='ui3-site-footer';
    footer.innerHTML='\
      <div class="ui3-footer-brand">\
        <img src="/shared/assets/408-farmers-logo-white.png" alt="408FARMERS Insurance Text Line" width="1014" height="215" loading="lazy" decoding="async">\
        <p>Personalized insurance reviews and South Bay local resources from Dylan at the Virginia Tam Insurance Agency.</p>\
      </div>\
      <div class="ui3-footer-links">\
        <div><strong>Explore</strong><a href="/home/">Home</a><a href="/auto-bundle/">Home + Auto</a><a href="/buyer/">Buyers</a><a href="/life/">Life</a><a href="/local/">Local</a></div>\
        <div><strong>Professional</strong><a href="/healthcare/">Healthcare</a><a href="/teachers/">Teachers</a><a href="/tech/">Technology</a><a href="/engineers/">Engineers</a><a href="/score/">Protection Score</a></div>\
        <div><strong>Contact</strong><a href="tel:+14083276377">(408) 327-6377</a><a href="sms:+14083276377">Text 408-FARMERS</a><a href="mailto:dylan.vtam@farmersagency.com">Email Dylan</a><a href="/contact/">Contact options</a></div>\
      </div>\
      <div class="ui3-footer-legal">\
        <p>Virginia Tam Insurance Agency, Inc. · Dylan Haysbert · CA License #4528400</p>\
        <p><a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></p>\
      </div>';
  }

  enhanceHeader();
  enhanceFooter();
})();
