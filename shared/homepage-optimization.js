(() => {
  'use strict';
  const pushEvent = (name, details = {}) => {
    const payload = { event: name, page_path: location.pathname, ...details };
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    window.dispatchEvent(new CustomEvent('408farmers:analytics', { detail: payload }));
  };
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-track-event]');
    if (!link) return;
    pushEvent(link.dataset.trackEvent, {
      event_location: link.dataset.trackLocation || 'homepage',
      event_label: link.dataset.trackLabel || link.textContent.trim().replace(/\s+/g, ' ').slice(0, 120),
      destination: link.getAttribute('href') || ''
    });
  });
  const sections = ['start', 'professionals', 'contact'];
  if ('IntersectionObserver' in window) {
    const viewed = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || viewed.has(entry.target.id)) return;
        viewed.add(entry.target.id);
        pushEvent('section_view', { event_label: entry.target.id, event_location: 'homepage' });
      });
    }, { threshold: 0.35 });
    sections.forEach((id) => { const el = document.getElementById(id); if (el) observer.observe(el); });
  }
  document.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener('click', (event) => {
    const id = link.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
  }));
})();
