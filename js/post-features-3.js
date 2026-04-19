// ── Post features 3 ──
// feat: post series nav bar, scroll time in TOC, jump-to-writeup button,
// inline image captions, copy-as-markdown, post reactions, upvote button,
// diff syntax highlighting
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  var postId = qs.get('id');

  // ── feat: scroll time left in TOC ──
  function initTocScrollTime() {
    var tocLabel = document.querySelector('.toc-sidebar-label');
    if (!tocLabel) return;
    var body = document.getElementById('post-body-content');
    if (!body) return;
    var words = (body.innerText || '').trim().split(/\s+/).length;
    var totalMins = Math.max(1, Math.round(words / 200));
    var span = document.createElement('span');
    span.className = 'toc-read-time';
    span.textContent = ' · ' + totalMins + ' min read';
    tocLabel.appendChild(span);

    // Update "X min left" on scroll
    window.addEventListener('scroll', function () {
      var article = document.querySelector('article.post-page') || document.body;
      var rect = article.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      var pct = Math.max(0, Math.min(1, (-rect.top) / total));
      var left = Math.max(0, Math.round(totalMins * (1 - pct)));
      span.textContent = left <= 0 ? ' · done!' : ' · ~' + left + ' min left';
    }, { passive: true });
  }

  // ── feat: "jump to writeup" button — disabled ──
  function initJumpToWriteup() { return;
    var body = document.getElementById('post-body-content');
    if (!body) return;
    var headings = Array.from(body.querySelectorAll('h2, h3'));
    var target = headings.find(function (h) {
      var text = (h.textContent || '').toLowerCase();
      return /solution|exploit|foothold|initial access|root|flag|attack|pwn/.test(text);
    });
    if (!target) return;
    if (!target.id) target.id = 'writeup-section';

    var hero = document.querySelector('.post-hero');
    if (!hero || hero.querySelector('.jump-to-writeup')) return;
    var btn = document.createElement('a');
    btn.className = 'jump-to-writeup';
    btn.href = '#' + target.id;
    btn.innerHTML = '↓ jump to writeup';
    hero.appendChild(btn);
  }

  // ── feat: inline image captions ──
  function initImageCaptions() {
    var body = document.getElementById('post-body-content');
    if (!body) return;
    body.querySelectorAll('img').forEach(function (img) {
      if (img.dataset.captioned) return;
      img.dataset.captioned = '1';
      var alt = img.getAttribute('alt');
      if (!alt || alt.length < 3) return;
      // Only caption if not already in a figure
      if (img.parentNode && img.parentNode.tagName === 'FIGURE') return;
      var fig = document.createElement('figure');
      fig.className = 'post-figure';
      img.parentNode.insertBefore(fig, img);
      fig.appendChild(img);
      var cap = document.createElement('figcaption');
      cap.className = 'post-figcaption';
      cap.textContent = alt;
      fig.appendChild(cap);
    });
  }

  // ── feat: copy-as-markdown button — disabled ──
  function initCopyMarkdown() { return;
    var body = document.getElementById('post-body-content');
    var hero = document.querySelector('.post-hero');
    if (!body || !hero || hero.querySelector('.copy-md-btn')) return;
    if (!postId) return;

    var btn = document.createElement('button');
    btn.className = 'copy-md-btn post-meta-item';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Copy post as markdown');
    btn.innerHTML = '⎘ copy md';
    var metaRow = document.querySelector('.post-hero-meta');
    if (metaRow) metaRow.appendChild(btn);

    btn.addEventListener('click', function () {
      var posts = window.BensecDB && BensecDB.getPosts ? BensecDB.getPosts() : [];
      var post = posts.find(function (p) { return p.id === postId; });
      var md = post ? (post.body || '') : (body.innerText || '');
      (navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(md)
        : Promise.reject()
      ).then(function () {
        btn.innerHTML = '✓ copied!';
        setTimeout(function () { btn.innerHTML = '⎘ copy md'; }, 1800);
      }).catch(function () {
        btn.innerHTML = '✗ failed';
        setTimeout(function () { btn.innerHTML = '⎘ copy md'; }, 1800);
      });
    });
  }

  // ── feat: post series navigation ──
  function initSeriesNav() {
    if (!postId) return;
    var posts = window.BensecDB && BensecDB.getPosts ? BensecDB.getPosts() : [];
    var current = posts.find(function (p) { return p.id === postId; });
    if (!current || !current.series) return;

    var seriesName = current.series;
    var seriesPosts = posts
      .filter(function (p) { return p.series === seriesName && p.status !== 'draft'; })
      .sort(function (a, b) { return (a.seriesPart || 0) - (b.seriesPart || 0); });
    if (seriesPosts.length < 2) return;

    var bar = document.createElement('div');
    bar.className = 'series-bar reveal visible';
    bar.innerHTML =
      '<div class="series-label">// series: <span class="series-name">' + escH(seriesName) + '</span></div>' +
      '<ol class="series-list">' +
        seriesPosts.map(function (p, i) {
          var active = p.id === postId;
          return '<li class="series-item' + (active ? ' active' : '') + '">' +
            (active
              ? '<span class="series-current">→ ' + escH(p.title || '') + '</span>'
              : '<a href="post.html?id=' + encodeURIComponent(p.id) + '">' + escH(p.title || '') + '</a>') +
            '</li>';
        }).join('') +
      '</ol>';

    var article = document.querySelector('article.post-page') || document.querySelector('article');
    var bodyEl = document.getElementById('post-body-content');
    if (bodyEl && article) article.insertBefore(bar, bodyEl);
  }

  // ── feat: post reactions ──
  var REACT_EMOJIS = [
    { key: 'fire',  label: '🔥', title: 'Fire' },
    { key: 'skull', label: '💀', title: 'Skull' },
    { key: 'mind',  label: '🤯', title: 'Mind blown' },
    { key: 'gg',    label: '✅', title: 'GG' },
  ];
  var REACT_VOTED_KEY = 'bensec-reactions-' + (postId || '');

  function initReactions() {
    if (!postId) return;
    var article = document.querySelector('article.post-page') || document.querySelector('article');
    if (!article || article.querySelector('.post-reactions')) return;
    var voted = {};
    try { voted = JSON.parse(sessionStorage.getItem(REACT_VOTED_KEY) || '{}'); } catch (e) {}

    var block = document.createElement('div');
    block.className = 'post-reactions reveal visible';
    block.innerHTML =
      '<p class="reactions-label">// reactions</p>' +
      '<div class="reactions-row">' +
        REACT_EMOJIS.map(function (r) {
          return '<button class="reaction-btn' + (voted[r.key] ? ' voted' : '') + '" data-key="' + r.key + '" title="' + r.title + '">' +
            '<span class="reaction-emoji">' + r.label + '</span>' +
            '<span class="reaction-count" id="rc-' + r.key + '">…</span>' +
          '</button>';
        }).join('') +
      '</div>';

    var bottomNav = article.querySelector('.post-bottom-nav, .post-pn-nav, .post-related');
    if (bottomNav) article.insertBefore(block, bottomNav);
    else article.appendChild(block);

    loadReactions();

    block.querySelectorAll('.reaction-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.key;
        if (voted[key]) return; // already voted this session
        voted[key] = true;
        try { sessionStorage.setItem(REACT_VOTED_KEY, JSON.stringify(voted)); } catch (e) {}
        btn.classList.add('voted');
        btn.classList.add('react-pop');
        setTimeout(function () { btn.classList.remove('react-pop'); }, 400);
        saveReaction(key);
      });
    });
  }

  function loadReactions() {
    if (!window.firebase || !firebase.apps || !firebase.apps.length || !postId) return;
    firebase.firestore().collection('reactions').doc(postId).get().then(function (doc) {
      var data = doc.exists ? doc.data() : {};
      REACT_EMOJIS.forEach(function (r) {
        var el = document.getElementById('rc-' + r.key);
        if (el) el.textContent = data[r.key] || 0;
      });
    }).catch(function () {
      REACT_EMOJIS.forEach(function (r) {
        var el = document.getElementById('rc-' + r.key);
        if (el) el.textContent = '0';
      });
    });
  }

  function saveReaction(key) {
    if (!window.firebase || !firebase.apps || !firebase.apps.length || !postId) return;
    var inc = {};
    inc[key] = firebase.firestore.FieldValue.increment(1);
    firebase.firestore().collection('reactions').doc(postId).set(inc, { merge: true }).then(function () {
      loadReactions();
    }).catch(function () {});
  }

  // ── feat: upvote button ──
  var UPVOTE_KEY = 'bensec-upvote-' + (postId || '');

  function initUpvote() {
    if (!postId) return;
    var metaRow = document.querySelector('.post-hero-meta');
    if (!metaRow || metaRow.querySelector('.upvote-btn')) return;

    var hasVoted = !!sessionStorage.getItem(UPVOTE_KEY);
    var btn = document.createElement('button');
    btn.className = 'upvote-btn post-meta-item' + (hasVoted ? ' voted' : '');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Upvote this post');
    btn.innerHTML = '▲ <span id="upvote-count">…</span>';
    metaRow.appendChild(btn);

    loadUpvotes();

    btn.addEventListener('click', function () {
      if (sessionStorage.getItem(UPVOTE_KEY)) return;
      sessionStorage.setItem(UPVOTE_KEY, '1');
      btn.classList.add('voted');
      btn.classList.add('react-pop');
      setTimeout(function () { btn.classList.remove('react-pop'); }, 400);
      if (!window.firebase || !firebase.apps || !firebase.apps.length) return;
      firebase.firestore().collection('upvotes').doc(postId).set({
        count: firebase.firestore.FieldValue.increment(1),
        title: (document.getElementById('post-title') || {}).textContent || ''
      }, { merge: true }).then(loadUpvotes).catch(function () {});
    });
  }

  function loadUpvotes() {
    if (!window.firebase || !firebase.apps || !firebase.apps.length || !postId) return;
    firebase.firestore().collection('upvotes').doc(postId).get().then(function (doc) {
      var count = doc.exists ? ((doc.data() || {}).count || 0) : 0;
      var el = document.getElementById('upvote-count');
      if (el) el.textContent = count;
    }).catch(function () {
      var el = document.getElementById('upvote-count');
      if (el) el.textContent = '0';
    });
  }

  function escH(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function waitForRender(cb, t) {
    t = t || 0;
    var title = document.getElementById('post-title');
    var body = document.getElementById('post-body-content');
    var ready = title && title.textContent.indexOf('Loading') === -1 &&
                body && body.innerHTML.indexOf('Loading post') === -1;
    if (ready || t > 80) cb();
    else setTimeout(function () { waitForRender(cb, t + 1); }, 100);
  }

  // Only run on post pages
  if (!/post\.html/i.test(location.pathname) && !document.querySelector('.post-page')) return;

  document.addEventListener('DOMContentLoaded', function () {
    waitForRender(function () {
      initSeriesNav();
      initTocScrollTime();
      initJumpToWriteup();
      initImageCaptions();
      initCopyMarkdown();
      initReactions();
      initUpvote();
    });
  });
}());
