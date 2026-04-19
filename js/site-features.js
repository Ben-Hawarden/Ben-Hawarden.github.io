// ── site-features.js ──
// feat: Fuse.js full-text search, social proof strip, animated section
// transitions (IntersectionObserver), Spotify "now playing" widget,
// email notify strip, keyboard shortcut modal (non-admin pages)
(function () {
  'use strict';

  // ── feat: animated section transitions (IntersectionObserver) ──
  function initRevealObserver() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  // ── feat: Fuse.js full-text search augmentation ──
  function initFuseSearch() {
    var input = document.getElementById('blog-search');
    if (!input) return;

    // Load Fuse lazily on first focus
    var fuseReady = false;
    function loadFuse(cb) {
      if (window.Fuse) { cb(); return; }
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js';
      s.onload = cb;
      document.head.appendChild(s);
    }

    input.addEventListener('focus', function () {
      if (fuseReady) return;
      loadFuse(function () { fuseReady = true; });
    }, { once: true });

    // Hook into existing search after blog-engine renders posts
    var searchTimer;
    input.addEventListener('input', function () {
      if (!window.Fuse) return; // fall back to native engine if not loaded
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        var q = (input.value || '').trim();
        if (!q) return; // let existing engine handle empty
        runFuseSearch(q);
      }, 150);
    });

    function runFuseSearch(q) {
      var posts = window.BensecDB && BensecDB.getPosts
        ? BensecDB.getPosts().filter(function (p) { return p.status !== 'draft'; })
        : [];
      if (!posts.length) return;

      var fuse = new window.Fuse(posts, {
        keys: [
          { name: 'title',   weight: 3 },
          { name: 'tags',    weight: 2 },
          { name: 'summary', weight: 1.5 },
          { name: 'body',    weight: 1 }
        ],
        threshold: 0.38,
        includeScore: true,
        ignoreLocation: true
      });

      var results = fuse.search(q);
      var matchIds = {};
      results.forEach(function (r) { matchIds[r.item.id] = true; });

      // Show/hide rendered post cards
      var cards = document.querySelectorAll('.post[data-id], .post-card[data-id], [data-post-id]');
      if (!cards.length) return;
      cards.forEach(function (card) {
        var id = card.dataset.id || card.dataset.postId;
        var matches = !id || matchIds[id];
        card.classList.toggle('search-hidden', !matches);
        card.style.display = matches ? '' : 'none';
      });

      // Update count
      var countEl = document.getElementById('blog-search-count');
      if (countEl) {
        var n = results.length;
        countEl.textContent = n + ' match' + (n === 1 ? '' : 'es');
      }
    }
  }

  // ── feat: social proof strip — disabled ──
  function initSocialProof() { return; /* removed per user request */
    var hero = document.querySelector('.hero');
    if (!hero || hero.querySelector('.social-proof-strip')) return;

    var strip = document.createElement('div');
    strip.className = 'social-proof-strip reveal';
    strip.innerHTML =
      '<a class="social-proof-item" href="https://tryhackme.com/p/Ben" target="_blank" rel="noopener">' +
        '<span class="sp-icon">🏆</span>' +
        '<span class="sp-badge">TryHackMe · Top 2%</span>' +
      '</a>' +
      '<a class="social-proof-item" href="https://app.hackthebox.com/users/Ben" target="_blank" rel="noopener">' +
        '<span class="sp-icon">🟩</span>' +
        '<span class="sp-badge">HTB · Pro Hacker</span>' +
      '</a>' +
      '<a class="social-proof-item" href="https://github.com/Ben-Hawarden" target="_blank" rel="noopener">' +
        '<span class="sp-icon">🐙</span>' +
        '<span class="sp-badge" id="gh-streak">GitHub</span>' +
      '</a>' +
      '<span class="social-proof-item">' +
        '<span class="sp-icon">🚩</span>' +
        '<span class="sp-badge" id="sp-post-count">blog posts</span>' +
      '</span>';

    // Insert after hero-links
    var heroLinks = hero.querySelector('.hero-links');
    if (heroLinks) heroLinks.insertAdjacentElement('afterend', strip);
    else hero.appendChild(strip);

    // Fill post count
    var posts = window.BensecDB && BensecDB.getPosts
      ? BensecDB.getPosts().filter(function (p) { return p.status !== 'draft'; })
      : [];
    var countEl = document.getElementById('sp-post-count');
    if (countEl) countEl.textContent = posts.length + ' post' + (posts.length === 1 ? '' : 's');

    // Try to fill later if posts not loaded yet
    if (!posts.length) {
      setTimeout(function () {
        var p = window.BensecDB && BensecDB.getPosts
          ? BensecDB.getPosts().filter(function (x) { return x.status !== 'draft'; })
          : [];
        if (countEl) countEl.textContent = p.length + ' post' + (p.length === 1 ? '' : 's');
      }, 1500);
    }
  }

  // ── feat: Spotify "now playing" widget ──
  // Admin manually updates config/spotify doc: { track, artist, art, playing, link }
  function initSpotify() {
    var targets = document.querySelectorAll('.spotify-widget-slot');
    if (!targets.length) return;
    if (!window.firebase || !firebase.apps || !firebase.apps.length) return;

    firebase.firestore().collection('config').doc('spotify').get().then(function (doc) {
      if (!doc.exists) return;
      var d = doc.data() || {};
      if (!d.track) return;

      targets.forEach(function (slot) {
        var widget = document.createElement('div');
        widget.className = 'spotify-widget' + (d.playing ? '' : ' paused');
        var artHtml = d.art
          ? '<img class="sp-art" src="' + d.art + '" alt="album art" loading="lazy">'
          : '<div class="sp-art-placeholder">🎵</div>';

        widget.innerHTML =
          artHtml +
          '<div class="sp-info">' +
            '<div class="sp-track">' + escH(d.track) + '</div>' +
            '<div class="sp-artist">' + escH(d.artist || '') + '</div>' +
          '</div>' +
          (d.playing
            ? '<div class="sp-eq"><span></span><span></span><span></span></div>'
            : '') +
          '<span class="sp-logo" title="Spotify">♫</span>';

        if (d.link) {
          var a = document.createElement('a');
          a.href = d.link;
          a.target = '_blank';
          a.rel = 'noopener';
          a.setAttribute('aria-label', 'Listen on Spotify');
          a.style.textDecoration = 'none';
          a.appendChild(widget);
          slot.replaceWith(a);
        } else {
          slot.replaceWith(widget);
        }
      });
    }).catch(function () {});
  }

  // ── feat: email notify strip on blog ──
  function initEmailNotify() {
    var target = document.getElementById('blog-notify-slot');
    if (!target) return;

    var FORMSPREE = 'https://formspree.io/f/YOUR_FORM_ID'; // user sets this
    var strip = document.createElement('div');
    strip.className = 'notify-strip reveal';
    strip.innerHTML =
      '<label for="notify-email">📬 get notified of new posts:</label>' +
      '<input type="email" id="notify-email" placeholder="you@example.com" autocomplete="email">' +
      '<button class="notify-btn" id="notify-submit">notify me</button>' +
      '<span class="notify-msg">✓ you\'re subscribed!</span>';
    target.replaceWith(strip);

    document.getElementById('notify-submit').addEventListener('click', function () {
      var email = (document.getElementById('notify-email') || {}).value || '';
      if (!email || !/\S+@\S+\.\S+/.test(email)) {
        alert('Please enter a valid email.');
        return;
      }
      // Submit to Formspree (or just mark as submitted if placeholder)
      if (FORMSPREE.includes('YOUR_FORM_ID')) {
        // Demo mode
        strip.classList.add('submitted');
        return;
      }
      fetch(FORMSPREE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: email, _subject: 'New blog subscriber' })
      }).then(function (r) {
        if (r.ok) strip.classList.add('submitted');
        else alert('Something went wrong. Try again later.');
      }).catch(function () { alert('Network error. Try again later.'); });
    });
  }

  // ── feat: keyboard shortcut modal on all non-admin pages ──
  function initKbdModal() {
    if (document.getElementById('kbd-modal-overlay')) return;
    if (/admin\.html/i.test(location.pathname)) return; // admin-extras-5 handles it

    var overlay = document.createElement('div');
    overlay.id = 'kbd-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Keyboard shortcuts');
    overlay.innerHTML =
      '<div id="kbd-modal">' +
        '<button class="kbd-close" id="kbd-modal-close" aria-label="Close">✕</button>' +
        '<h2>// keyboard shortcuts</h2>' +

        '<p class="kbd-section-title">Navigation</p>' +
        '<div class="kbd-row"><span>Command palette</span><div><kbd>Ctrl</kbd><kbd>K</kbd></div></div>' +
        '<div class="kbd-row"><span>In-post search</span><div><kbd>Ctrl</kbd><kbd>F</kbd></div></div>' +
        '<div class="kbd-row"><span>Focus blog search</span><div><kbd>/</kbd></div></div>' +
        '<div class="kbd-row"><span>This modal</span><div><kbd>?</kbd></div></div>' +
        '<div class="kbd-row"><span>Close overlay</span><div><kbd>Esc</kbd></div></div>' +

        '<p class="kbd-section-title">Blog</p>' +
        '<div class="kbd-row"><span>Next post</span><div><kbd>→</kbd></div></div>' +
        '<div class="kbd-row"><span>Prev post</span><div><kbd>←</kbd></div></div>' +
        '<div class="kbd-row"><span>Back to top</span><div><kbd>Home</kbd></div></div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('kbd-modal-close').addEventListener('click', closeKbd);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeKbd(); });
  }

  function closeKbd() {
    var o = document.getElementById('kbd-modal-overlay');
    if (o) { o.classList.remove('open'); document.body.style.overflow = ''; }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== '?') return;
    var tag = (document.activeElement || {}).tagName || '';
    if (/input|textarea|select/i.test(tag)) return;
    var overlay = document.getElementById('kbd-modal-overlay');
    if (!overlay) return;
    overlay.classList.toggle('open');
    document.body.style.overflow = overlay.classList.contains('open') ? 'hidden' : '';
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var o = document.getElementById('kbd-modal-overlay');
      if (o && o.classList.contains('open')) { o.classList.remove('open'); document.body.style.overflow = ''; }
    }
  });

  function escH(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── Init ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    initRevealObserver();
    initKbdModal();
    initFuseSearch();
    initSocialProof();
    initSpotify();
    initEmailNotify();

    // Re-run reveal observer after dynamic content loads
    setTimeout(initRevealObserver, 600);
    setTimeout(initRevealObserver, 1500);
  }
}());
