// ── Site-wide extras ──
// feat: mobile nav smooth open/close + outside-tap close
// feat: scroll parallax on hero
// feat: cursor trail Easter egg
// feat: NProgress-style page-transition bar
// feat: arrow-key prev/next on post.html
(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Mobile nav: outside-tap closes ──
  document.addEventListener('click', function (e) {
    var nav = document.querySelector('.nav-links.open');
    var btn = document.querySelector('.mobile-menu-btn');
    if (!nav || !btn) return;
    if (nav.contains(e.target) || btn.contains(e.target)) return;
    nav.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });

  // ── Scroll parallax on hero sections ──
  if (!reduced) {
    var heroes = document.querySelectorAll('.hero, .blog-header, .post-hero');
    if (heroes.length) {
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          var y = window.scrollY;
          heroes.forEach(function (el) {
            var speed = 0.25;
            el.style.transform = 'translate3d(0,' + (y * speed * -1) + 'px,0)';
            el.style.opacity = Math.max(0, 1 - (y / 600));
          });
          ticking = false;
        });
      }, { passive: true });
    }
  }

  // ── NProgress-style loading bar for page transitions ──
  var loadBar = document.createElement('div');
  loadBar.id = 'nav-progress';
  document.body && document.body.appendChild(loadBar);
  document.querySelectorAll('a[href]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;
    a.addEventListener('click', function () {
      loadBar.style.width = '0%';
      loadBar.classList.add('active');
      requestAnimationFrame(function () {
        loadBar.style.width = '85%';
      });
    });
  });
  window.addEventListener('pageshow', function () {
    loadBar.style.width = '100%';
    setTimeout(function () {
      loadBar.classList.remove('active');
      loadBar.style.width = '0%';
    }, 220);
  });

  // ── Cursor trail Easter egg ──
  // Off by default. Toggle via footer chip — state in localStorage.
  var TRAIL_KEY = 'bensec-cursor-trail';
  var trailActive = localStorage.getItem(TRAIL_KEY) === '1';
  var trailHandler = null;

  function startTrail() {
    if (trailHandler || reduced) return;
    trailHandler = function (e) {
      var c = document.createElement('span');
      c.className = 'cursor-trail';
      c.textContent = Math.random() > 0.5 ? '>' : '_';
      c.style.left = e.pageX + 'px';
      c.style.top  = e.pageY + 'px';
      document.body.appendChild(c);
      setTimeout(function () { c.remove(); }, 700);
    };
    window.addEventListener('mousemove', trailHandler);
    document.documentElement.classList.add('trail-on');
  }
  function stopTrail() {
    if (!trailHandler) return;
    window.removeEventListener('mousemove', trailHandler);
    trailHandler = null;
    document.documentElement.classList.remove('trail-on');
  }
  if (trailActive) startTrail();

  // Inject a footer toggle chip once footer exists
  function injectTrailToggle() {
    var footer = document.querySelector('footer .footer-links');
    if (!footer || footer.querySelector('.trail-toggle')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'trail-toggle';
    b.setAttribute('aria-pressed', trailActive ? 'true' : 'false');
    b.title = 'Toggle cursor trail Easter egg';
    b.textContent = trailActive ? '[>_] trail on' : '[>_] trail';
    b.addEventListener('click', function () {
      trailActive = !trailActive;
      localStorage.setItem(TRAIL_KEY, trailActive ? '1' : '0');
      if (trailActive) startTrail(); else stopTrail();
      b.setAttribute('aria-pressed', trailActive ? 'true' : 'false');
      b.textContent = trailActive ? '[>_] trail on' : '[>_] trail';
    });
    footer.appendChild(b);
  }
  document.addEventListener('DOMContentLoaded', injectTrailToggle);
  setTimeout(injectTrailToggle, 500);

  // ── Arrow-key prev/next on post.html ──
  if (/post\.html/i.test(location.pathname) || document.querySelector('.post-page')) {
    document.addEventListener('keydown', function (e) {
      // Ignore when typing in a field
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (/input|textarea|select/i.test(tag)) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        var sel = e.key === 'ArrowLeft' ? '.post-pn-prev' : '.post-pn-next';
        var link = document.querySelector(sel);
        if (link && !link.classList.contains('disabled') && link.getAttribute('href')) {
          location.href = link.getAttribute('href');
        }
      }
    });
  }
}());
