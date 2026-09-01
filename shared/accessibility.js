(function (window, document) {
  'use strict';

  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a.skip-link[href^="#"]');
    if (!link) return;
    var id = decodeURIComponent(link.getAttribute('href').slice(1));
    var target = document.getElementById(id);
    if (!target) return;

    event.preventDefault();
    try { target.focus({ preventScroll: true }); } catch (_) { target.focus(); }
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    if (window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(null, '', '#' + encodeURIComponent(id));
    }
  });
})(window, document);
