// ── Blog page extras ──
// feat: post view count badges on blog cards (reads analytics/ collection)
// feat: highlight matching text in search results
(function () {
  'use strict';

  function waitFor(sel, cb, tries) {
    tries = tries || 0;
    var el = document.querySelector(sel);
    if (el && el.children.length > 0) return cb(el);
    if (tries > 40) return;
    setTimeout(function () { waitFor(sel, cb, tries + 1); }, 200);
  }

  // ── View count badges ──
  function injectViewCounts() {
    if (!window.firebase || !firebase.apps || !firebase.apps.length) return;
    firebase.firestore().collection('analytics').get().then(function (snap) {
      var views = {};
      snap.docs.forEach(function (d) {
        var data = d.data() || {};
        views[d.id] = data.views || 0;
      });
      document.querySelectorAll('.post, .blog-post-card, .post-card').forEach(function (card) {
        if (card.querySelector('.view-count-badge')) return;
        // Find post id from link
        var link = card.querySelector('a[href*="post.html?id="]');
        if (!link) return;
        var m = /id=([^&]+)/.exec(link.getAttribute('href') || '');
        if (!m) return;
        var id = decodeURIComponent(m[1]);
        var n = views[id] || 0;
        if (n <= 0) return;
        var badge = document.createElement('span');
        badge.className = 'view-count-badge';
        badge.innerHTML = '👁 ' + n + (n === 1 ? ' view' : ' views');
        // Try to place in meta area
        var meta = card.querySelector('.post-meta, .post-card-meta, .post-header-meta');
        if (meta) meta.appendChild(badge);
        else card.appendChild(badge);
      });
    }).catch(function () { /* silent */ });
  }

  // ── Search highlight ──
  var ORIGINALS = new WeakMap();
  function highlight(text, q) {
    if (!q) return text;
    var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return text.replace(re, '<mark class="search-hl">$1</mark>');
  }
  function applyHighlight(q) {
    document.querySelectorAll('#blog-posts .post, .post:not(.post-page), .blog-post-card').forEach(function (card) {
      // Cache originals of title + summary elements once
      ['h2', 'h3', '.post-title', '.post-summary', 'p.dim', '.summary'].forEach(function (sel) {
        card.querySelectorAll(sel).forEach(function (el) {
          if (!ORIGINALS.has(el)) ORIGINALS.set(el, el.innerHTML);
          var orig = ORIGINALS.get(el);
          if (!q) { el.innerHTML = orig; return; }
          // Strip existing highlight-wrapped HTML then re-apply (safe because we restore from orig)
          var tmp = document.createElement('div');
          tmp.innerHTML = orig;
          walk(tmp, function (node) { node.nodeValue = node.nodeValue; });
          // Simpler: highlight over the plain-text parts only
          el.innerHTML = highlightHtml(orig, q);
        });
      });
    });
  }
  function highlightHtml(html, q) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    walk(tmp, function (node) {
      var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      if (!re.test(node.nodeValue)) return;
      var span = document.createElement('span');
      span.innerHTML = node.nodeValue.replace(re, '<mark class="search-hl">$1</mark>');
      node.parentNode.replaceChild(span, node);
    });
    return tmp.innerHTML;
  }
  function walk(root, fn) {
    var nodes = [];
    (function collect(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) nodes.push(c);
        else if (c.nodeType === 1 && c.tagName !== 'MARK') collect(c);
      }
    }(root));
    nodes.forEach(fn);
  }

  function hookSearch() {
    var input = document.getElementById('blog-search');
    if (!input || input.__hlHooked) return;
    input.__hlHooked = true;
    var t;
    input.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var q = (input.value || '').trim();
        applyHighlight(q);
      }, 80);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    waitFor('#blog-posts', injectViewCounts);
    waitFor('#blog-posts', hookSearch);
  });
}());
