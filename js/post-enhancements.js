// ── Post page enhancements ──
// Hooks on top of blog-engine.js rendering without modifying it.
// Features: Prism highlight, copy-code, reading progress bar, related posts,
// back-to-top, prev/next nav, last-updated display, analytics increment.
(function () {
  'use strict';

  if (!/post\.html/i.test(location.pathname) && !document.querySelector('.post-page')) return;

  var qs = new URLSearchParams(location.search);
  var postId = qs.get('id');

  // Wait for blog-engine to render, then enhance
  function waitForRender(cb, tries) {
    tries = tries || 0;
    var body = document.getElementById('post-body-content');
    if (!body) return;
    // Heuristic: "Loading..." gone from title and body has real content
    var title = document.getElementById('post-title');
    var loaded = title && title.textContent && title.textContent.indexOf('Loading') === -1 &&
                 body.innerHTML && body.innerHTML.indexOf('Loading post') === -1;
    if (loaded || tries > 80) { cb(); return; }
    setTimeout(function () { waitForRender(cb, tries + 1); }, 100);
  }

  // ── feat: reading progress bar ──
  function initProgressBar() {
    var bar = document.createElement('div');
    bar.id = 'reading-progress';
    document.body.appendChild(bar);
    function update() {
      var article = document.querySelector('article.post-page') || document.querySelector('article') || document.body;
      var rect = article.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      var scrolled = -rect.top;
      var pct = Math.max(0, Math.min(100, (scrolled / total) * 100));
      if (!isFinite(pct)) pct = 0;
      bar.style.width = pct + '%';
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // ── feat: back-to-top button ──
  function initBackToTop() {
    var btn = document.createElement('button');
    btn.id = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '↑';
    document.body.appendChild(btn);
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.addEventListener('scroll', function () {
      btn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
  }

  // ── feat: copy-code buttons ──
  function initCopyCode() {
    var body = document.getElementById('post-body-content');
    if (!body) return;
    body.querySelectorAll('pre').forEach(function (pre) {
      if (pre.querySelector('.post-copy-btn')) return;
      pre.classList.add('post-pre-wrap');
      var btn = document.createElement('button');
      btn.className = 'post-copy-btn';
      btn.type = 'button';
      btn.textContent = 'copy';
      btn.setAttribute('aria-label', 'Copy code to clipboard');
      btn.addEventListener('click', function () {
        var code = pre.querySelector('code') || pre;
        var text = code.innerText;
        (navigator.clipboard && navigator.clipboard.writeText
          ? navigator.clipboard.writeText(text)
          : Promise.reject()
        ).then(function () {
          btn.textContent = 'copied!';
          btn.classList.add('copied');
          setTimeout(function () { btn.textContent = 'copy'; btn.classList.remove('copied'); }, 1500);
        }).catch(function () {
          // Fallback: select text
          var r = document.createRange(); r.selectNodeContents(code);
          var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
          btn.textContent = 'select+copy';
          setTimeout(function () { btn.textContent = 'copy'; }, 1500);
        });
      });
      pre.appendChild(btn);
    });
  }

  // ── feat: Prism syntax highlighting ──
  function initPrism() {
    if (typeof window.Prism === 'undefined') return;
    var body = document.getElementById('post-body-content');
    if (!body) return;
    // Ensure each <pre><code> has a language-* class so autoloader fires
    body.querySelectorAll('pre > code').forEach(function (code) {
      var hasLang = false;
      (code.className || '').split(/\s+/).forEach(function (c) { if (/^language-/.test(c)) hasLang = true; });
      if (!hasLang) code.classList.add('language-none');
    });
    try { Prism.highlightAllUnder(body); } catch (e) { /* no-op */ }
  }

  // ── feat: related posts + prev/next nav ──
  function renderRelatedAndNav() {
    if (!window.BensecDB || !BensecDB.getPosts) return;
    var posts = BensecDB.getPosts().filter(function (p) { return p.status !== 'draft'; });
    if (!posts.length || !postId) return;
    var current = posts.find(function (p) { return p.id === postId; });
    if (!current) return;

    // Sort by date desc
    posts.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    var idx = posts.findIndex(function (p) { return p.id === postId; });
    var newer = idx > 0 ? posts[idx - 1] : null;    // prev = newer (higher on list)
    var older = idx < posts.length - 1 ? posts[idx + 1] : null;

    var tags = (current.tags || []).map(String);
    var related = posts
      .filter(function (p) { return p.id !== postId; })
      .map(function (p) {
        var ptags = (p.tags || []).map(String);
        var shared = ptags.filter(function (t) { return tags.indexOf(t) !== -1; }).length;
        return { post: p, shared: shared };
      })
      .filter(function (x) { return x.shared > 0; })
      .sort(function (a, b) {
        if (b.shared !== a.shared) return b.shared - a.shared;
        return (b.post.date || '').localeCompare(a.post.date || '');
      })
      .slice(0, 3)
      .map(function (x) { return x.post; });

    var article = document.querySelector('article.post-page') || document.querySelector('article');
    if (!article) return;

    // Prev/Next nav — insert before existing .post-bottom-nav
    var bottomNav = article.querySelector('.post-bottom-nav');
    if (newer || older) {
      var nav = document.createElement('div');
      nav.className = 'post-pn-nav reveal visible';
      nav.innerHTML =
        '<a class="post-pn-btn post-pn-prev ' + (older ? '' : 'disabled') + '" ' +
          (older ? 'href="post.html?id=' + encodeURIComponent(older.id) + '"' : '') + '>' +
          '<span class="post-pn-label">← older post</span>' +
          '<span class="post-pn-title">' + (older ? escapeHtml(older.title || '') : '—') + '</span>' +
        '</a>' +
        '<a class="post-pn-btn post-pn-next ' + (newer ? '' : 'disabled') + '" ' +
          (newer ? 'href="post.html?id=' + encodeURIComponent(newer.id) + '"' : '') + '>' +
          '<span class="post-pn-label">newer post →</span>' +
          '<span class="post-pn-title">' + (newer ? escapeHtml(newer.title || '') : '—') + '</span>' +
        '</a>';
      if (bottomNav) bottomNav.parentNode.insertBefore(nav, bottomNav);
      else article.appendChild(nav);
    }

    if (related.length) {
      var sec = document.createElement('section');
      sec.className = 'post-related reveal visible';
      sec.innerHTML =
        '<h3 class="post-related-title">// related posts</h3>' +
        '<div class="post-related-grid">' +
          related.map(function (p) {
            return '<a class="post-related-card" href="post.html?id=' + encodeURIComponent(p.id) + '">' +
              '<h4>' + escapeHtml(p.title || '') + '</h4>' +
              '<p class="post-related-date">' + escapeHtml(p.date || '') + '</p>' +
              '<div class="post-related-tags">' +
                (p.tags || []).slice(0, 4).map(function (t) {
                  return '<span class="post-related-tag">' + escapeHtml(t) + '</span>';
                }).join('') +
              '</div>' +
            '</a>';
          }).join('') +
        '</div>';
      if (bottomNav) bottomNav.parentNode.insertBefore(sec, bottomNav);
      else article.appendChild(sec);
    }

    // ── feat: last-updated timestamp ──
    if (current.updated && current.updated !== current.date) {
      var metaRow = document.querySelector('.post-hero-meta');
      if (metaRow && !metaRow.querySelector('.post-meta-updated')) {
        var el = document.createElement('span');
        el.className = 'post-meta-item post-meta-updated';
        el.innerHTML = '✎ updated: <span>' + escapeHtml(current.updated) + '</span>';
        metaRow.appendChild(el);
      }
    }
  }

  // ── feat: analytics view increment ──
  function recordView() {
    if (!postId) return;
    if (!window.firebase || !firebase.apps || !firebase.apps.length) return;
    try {
      var db = firebase.firestore();
      var title = '';
      var titleEl = document.getElementById('post-title');
      if (titleEl) title = titleEl.textContent || '';
      db.collection('analytics').doc(postId).set({
        views: firebase.firestore.FieldValue.increment(1),
        title: title,
        lastView: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(function () { /* silent */ });
    } catch (e) { /* silent */ }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initProgressBar();
    initBackToTop();
    waitForRender(function () {
      initCopyCode();
      initPrism();
      renderRelatedAndNav();
      recordView();
    });
  });
}());
