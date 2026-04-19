// ── Skeleton loaders ──
// feat: skeleton loaders — show pulsing placeholders while Firestore data loads
(function () {
  'use strict';
  var TARGETS = [
    { selector: '#blog-posts', template: 'post' },
    { selector: '#projects-grid', template: 'card' },
    { selector: '#projects-list', template: 'card' },
    { selector: '#cs-container', template: 'card' },
    { selector: '#cheatsheets-sections', template: 'card' }
  ];

  function makeSkeleton(kind) {
    var el = document.createElement('div');
    el.className = 'skeleton-card skeleton-' + kind;
    el.innerHTML =
      '<div class="skeleton-bar skeleton-w70"></div>' +
      '<div class="skeleton-bar skeleton-w40"></div>' +
      '<div class="skeleton-bar skeleton-w90"></div>' +
      '<div class="skeleton-bar skeleton-w60"></div>';
    return el;
  }

  function inject() {
    TARGETS.forEach(function (t) {
      var host = document.querySelector(t.selector);
      if (!host) return;
      if (host.dataset.skeletonShown) return;
      if (host.children.length > 0) return; // already populated
      host.dataset.skeletonShown = '1';
      host.classList.add('skeleton-host');
      for (var i = 0; i < 3; i++) host.appendChild(makeSkeleton(t.template));
    });
  }

  function clearIfPopulated() {
    TARGETS.forEach(function (t) {
      var host = document.querySelector(t.selector);
      if (!host) return;
      // If there's real content (any non-skeleton child), remove skeletons
      var hasReal = Array.from(host.children).some(function (c) { return !c.classList.contains('skeleton-card'); });
      if (hasReal) {
        Array.from(host.querySelectorAll('.skeleton-card')).forEach(function (s) { s.remove(); });
        host.classList.remove('skeleton-host');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    inject();
    // Poll a few times to detect when real content lands
    var checks = 0;
    var interval = setInterval(function () {
      clearIfPopulated();
      if (++checks > 30) clearInterval(interval);
    }, 250);

    // feat: Prism highlight after dynamic content loads (cheatsheets etc.)
    var prismChecks = 0;
    var prismInterval = setInterval(function () {
      if (typeof window.Prism !== 'undefined') {
        try { Prism.highlightAll(); } catch (e) {}
        if (++prismChecks > 8) clearInterval(prismInterval);
      } else if (++prismChecks > 20) {
        clearInterval(prismInterval);
      }
    }, 500);
  });
}());
