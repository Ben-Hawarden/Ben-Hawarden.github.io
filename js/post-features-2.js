// ── Post features 2 ──
// feat: in-post search (Ctrl+F), sticky sidebar TOC, copy-link on headings,
// image lightbox, code filename labels, lazy-load images, back-to-top everywhere,
// smooth scroll with header offset
(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── feat: smooth scroll with header offset (all pages) ──
  var HEADER_OFFSET = 68;
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    var target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    var top = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
    history.pushState(null, '', '#' + id);
  });

  // ── feat: back-to-top on all long pages ──
  (function () {
    if (document.getElementById('back-to-top')) return; // post page already has it
    var btn = document.createElement('button');
    btn.id = 'back-to-top-global';
    btn.className = 'back-to-top-btn';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '↑';
    document.body.appendChild(btn);
    window.addEventListener('scroll', function () {
      btn.classList.toggle('visible', window.scrollY > 500);
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }());

  // ── feat: lazy-load images on the whole page ──
  function lazyLoadImages() {
    document.querySelectorAll('img:not([loading])').forEach(function (img) {
      img.setAttribute('loading', 'lazy');
    });
  }
  document.addEventListener('DOMContentLoaded', lazyLoadImages);
  setTimeout(lazyLoadImages, 1000);
  setTimeout(lazyLoadImages, 3000);

  // post.html only ─────────────────────────────
  if (!/post\.html/i.test(location.pathname) && !document.querySelector('.post-page')) return;

  // ── feat: in-post search (Ctrl+F / Cmd+F override) ──
  var searchPanel = null;
  var searchMatches = [];
  var searchIdx = 0;
  var origMarkup = null;

  function buildSearchPanel() {
    if (searchPanel) { searchPanel.classList.remove('hidden'); document.getElementById('post-search-input').focus(); return; }
    searchPanel = document.createElement('div');
    searchPanel.id = 'post-search-panel';
    searchPanel.className = 'post-search-panel';
    searchPanel.innerHTML =
      '<span class="psp-prompt">/ </span>' +
      '<input id="post-search-input" type="text" placeholder="search in post…" autocomplete="off" spellcheck="false">' +
      '<span class="psp-count" id="psp-count"></span>' +
      '<button class="psp-nav" id="psp-prev" aria-label="Previous match">↑</button>' +
      '<button class="psp-nav" id="psp-next" aria-label="Next match">↓</button>' +
      '<button class="psp-close" id="psp-close" aria-label="Close search">✕</button>';
    document.body.appendChild(searchPanel);

    var inp = document.getElementById('post-search-input');
    document.getElementById('psp-close').addEventListener('click', closeSearch);
    document.getElementById('psp-prev').addEventListener('click', function () { navigateMatch(-1); });
    document.getElementById('psp-next').addEventListener('click', function () { navigateMatch(1); });
    inp.addEventListener('input', function () { doSearch(inp.value); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSearch();
      if (e.key === 'Enter') navigateMatch(e.shiftKey ? -1 : 1);
    });
    inp.focus();
  }

  function doSearch(q) {
    var body = document.getElementById('post-body-content');
    if (!body) return;
    if (origMarkup === null) origMarkup = body.innerHTML;
    if (!q.trim()) { body.innerHTML = origMarkup; searchMatches = []; updateCount(); return; }
    var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    body.innerHTML = origMarkup.replace(re, '<mark class="post-search-hl" tabindex="-1">$1</mark>');
    searchMatches = Array.from(body.querySelectorAll('.post-search-hl'));
    searchIdx = 0;
    if (searchMatches[0]) { searchMatches[0].classList.add('current'); scrollToMatch(searchMatches[0]); }
    updateCount();
  }

  function navigateMatch(dir) {
    if (!searchMatches.length) return;
    searchMatches[searchIdx].classList.remove('current');
    searchIdx = (searchIdx + dir + searchMatches.length) % searchMatches.length;
    searchMatches[searchIdx].classList.add('current');
    scrollToMatch(searchMatches[searchIdx]);
    updateCount();
  }

  function scrollToMatch(el) {
    var top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET - 40;
    window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
    el.focus();
  }

  function updateCount() {
    var cnt = document.getElementById('psp-count');
    if (cnt) cnt.textContent = searchMatches.length ? (searchIdx + 1) + ' / ' + searchMatches.length : '';
  }

  function closeSearch() {
    if (searchPanel) searchPanel.classList.add('hidden');
    var body = document.getElementById('post-body-content');
    if (body && origMarkup !== null) { body.innerHTML = origMarkup; origMarkup = null; }
    searchMatches = []; searchIdx = 0;
    document.removeEventListener('keydown', searchKeydown);
  }

  function searchKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (/textarea/i.test(tag)) return;
      e.preventDefault();
      buildSearchPanel();
    }
    if (e.key === 'Escape' && searchPanel && !searchPanel.classList.contains('hidden')) closeSearch();
  }
  document.addEventListener('keydown', searchKeydown);

  // ── feat: sticky sidebar TOC ──
  function initSidebarToc() {
    var body = document.getElementById('post-body-content');
    if (!body) return;
    var headings = body.querySelectorAll('h2, h3');
    if (headings.length < 3) return;

    var aside = document.createElement('aside');
    aside.id = 'post-sidebar-toc';
    aside.className = 'post-sidebar-toc';
    aside.innerHTML = '<p class="toc-sidebar-label">// contents</p><nav id="toc-sidebar-nav"></nav>';
    var nav = aside.querySelector('nav');

    headings.forEach(function (h, i) {
      if (!h.id) h.id = 'h-' + i;
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.className = 'toc-sb-item toc-sb-' + h.tagName.toLowerCase();
      a.textContent = h.textContent;
      nav.appendChild(a);
    });

    var article = document.querySelector('article.post-page') || document.querySelector('article');
    if (article) article.appendChild(aside);

    // Active section highlighting
    var items = Array.from(nav.querySelectorAll('a'));
    function updateActive() {
      var scrollY = window.scrollY + HEADER_OFFSET + 20;
      var active = null;
      headings.forEach(function (h, i) {
        if (h.getBoundingClientRect().top + window.scrollY <= scrollY) active = i;
      });
      items.forEach(function (a, i) { a.classList.toggle('active', i === active); });
    }
    window.addEventListener('scroll', updateActive, { passive: true });
    updateActive();
  }

  // ── feat: copy-link on headings ──
  function initHeadingLinks() {
    var body = document.getElementById('post-body-content');
    if (!body) return;
    body.querySelectorAll('h2, h3, h4').forEach(function (h) {
      if (h.querySelector('.heading-anchor')) return;
      if (!h.id) h.id = 'h-' + Math.random().toString(36).slice(2, 7);
      var btn = document.createElement('button');
      btn.className = 'heading-anchor';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Copy link to this section');
      btn.innerHTML = '🔗';
      btn.addEventListener('click', function () {
        var url = location.origin + location.pathname + '#' + h.id;
        (navigator.clipboard && navigator.clipboard.writeText
          ? navigator.clipboard.writeText(url)
          : Promise.reject()
        ).then(function () {
          btn.innerHTML = '✓';
          setTimeout(function () { btn.innerHTML = '🔗'; }, 1400);
        }).catch(function () {
          btn.innerHTML = url;
          setTimeout(function () { btn.innerHTML = '🔗'; }, 2500);
        });
      });
      h.appendChild(btn);
    });
  }

  // ── feat: image lightbox ──
  var lightbox = null;
  function initLightbox() {
    var body = document.getElementById('post-body-content');
    if (!body) return;
    body.querySelectorAll('img').forEach(function (img) {
      if (img.dataset.lbInit) return;
      img.dataset.lbInit = '1';
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () { openLightbox(img.src, img.alt); });
    });
  }

  function openLightbox(src, alt) {
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.id = 'lightbox';
      lightbox.className = 'lightbox';
      lightbox.innerHTML =
        '<div class="lightbox-inner">' +
          '<img class="lightbox-img" alt="">' +
          '<p class="lightbox-caption"></p>' +
        '</div>' +
        '<button class="lightbox-close" aria-label="Close image">✕</button>';
      document.body.appendChild(lightbox);
      lightbox.addEventListener('click', function (e) { if (e.target === lightbox || e.target.classList.contains('lightbox-close')) closeLightbox(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });
    }
    lightbox.querySelector('.lightbox-img').src = src;
    lightbox.querySelector('.lightbox-caption').textContent = alt || '';
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (lightbox) lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── feat: code filename labels ──
  function initFilenameLabels() {
    var body = document.getElementById('post-body-content');
    if (!body) return;
    body.querySelectorAll('pre > code').forEach(function (code) {
      var text = code.textContent || '';
      var firstLine = text.split('\n')[0].trim();
      var m = /^(?:\/\/|#|<!--|;)\s*([\w.\-/\\]+\.\w+)\s*$/.exec(firstLine);
      if (!m) return;
      var pre = code.parentNode;
      if (pre.querySelector('.code-filename')) return;
      var label = document.createElement('div');
      label.className = 'code-filename';
      label.textContent = m[1];
      pre.insertBefore(label, code);
      // Strip the filename comment from the visible code
      code.textContent = text.split('\n').slice(1).join('\n').replace(/^\n/, '');
    });
  }

  function waitAndRun(cb, tries) {
    tries = tries || 0;
    var body = document.getElementById('post-body-content');
    var title = document.getElementById('post-title');
    var ready = title && title.textContent.indexOf('Loading') === -1 &&
                body && body.innerHTML.indexOf('Loading post') === -1;
    if (ready || tries > 80) cb();
    else setTimeout(function () { waitAndRun(cb, tries + 1); }, 100);
  }

  document.addEventListener('DOMContentLoaded', function () {
    waitAndRun(function () {
      initSidebarToc();
      initHeadingLinks();
      initLightbox();
      initFilenameLabels();
      lazyLoadImages();
    });
  });
}());
