// ── Admin extras 2 ──
// feat: tag autocomplete, autosave every 60s, word count goal ring,
// paste-image from clipboard, unsaved-changes warning, inline row actions,
// OG image generator, sitemap + RSS download buttons
(function () {
  'use strict';

  if (!/admin\.html/i.test(location.pathname) && !document.getElementById('admin-dashboard')) return;

  // ── feat: tag autocomplete ──
  function initTagAutocomplete() {
    var input = document.getElementById('editor-tags');
    if (!input || input.__tagAuto) return;
    input.__tagAuto = true;

    var dd = document.createElement('div');
    dd.className = 'tag-autocomplete hidden';
    input.parentNode.appendChild(dd);

    function allTags() {
      var posts = (window.BensecDB && BensecDB.getPosts) ? BensecDB.getPosts() : [];
      var counts = {};
      posts.forEach(function (p) {
        (p.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
      });
      return Object.keys(counts).map(function (t) { return { t: t, n: counts[t] }; })
        .sort(function (a, b) { return b.n - a.n; });
    }

    function currentFragment() {
      // The last whitespace-separated token is what we're typing
      var val = input.value;
      var parts = val.split(/\s+/);
      return { frag: parts[parts.length - 1] || '', parts: parts };
    }

    function refresh() {
      var state = currentFragment();
      var frag = state.frag.toLowerCase();
      if (!frag) { dd.classList.add('hidden'); return; }
      var already = state.parts.slice(0, -1);
      var matches = allTags()
        .filter(function (x) { return x.t.toLowerCase().indexOf(frag) === 0 && already.indexOf(x.t) === -1; })
        .slice(0, 6);
      if (!matches.length) { dd.classList.add('hidden'); return; }
      dd.innerHTML = matches.map(function (m, i) {
        return '<div class="tag-auto-item' + (i === 0 ? ' active' : '') + '" data-tag="' + m.t + '">' +
                 '<span class="tag-auto-name">' + m.t + '</span>' +
                 '<span class="tag-auto-count">' + m.n + '</span>' +
               '</div>';
      }).join('');
      dd.classList.remove('hidden');
    }

    function pick(tag) {
      var state = currentFragment();
      state.parts[state.parts.length - 1] = tag;
      input.value = state.parts.join(' ') + ' ';
      dd.classList.add('hidden');
      input.focus();
    }

    input.addEventListener('input', refresh);
    input.addEventListener('keydown', function (e) {
      if (dd.classList.contains('hidden')) return;
      var items = dd.querySelectorAll('.tag-auto-item');
      var active = dd.querySelector('.tag-auto-item.active');
      var idx = Array.prototype.indexOf.call(items, active);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (active) active.classList.remove('active');
        items[(idx + 1) % items.length].classList.add('active');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (active) active.classList.remove('active');
        items[(idx - 1 + items.length) % items.length].classList.add('active');
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (active) { e.preventDefault(); pick(active.dataset.tag); }
      } else if (e.key === 'Escape') {
        dd.classList.add('hidden');
      }
    });
    dd.addEventListener('mousedown', function (e) {
      var item = e.target.closest('.tag-auto-item');
      if (!item) return;
      e.preventDefault();
      pick(item.dataset.tag);
    });
    input.addEventListener('blur', function () { setTimeout(function () { dd.classList.add('hidden'); }, 120); });
  }

  // ── feat: autosave every 60s ──
  var autosaveTimer = null;
  var lastSavedSnapshot = '';
  function initAutosave() {
    var editor = document.getElementById('post-editor');
    var titleEl = document.getElementById('editor-title');
    var bodyEl = document.getElementById('editor-body');
    var statusEl = document.getElementById('autosave-status');
    if (!editor || !titleEl || !bodyEl) return;
    if (editor.__autosaveInit) return;
    editor.__autosaveInit = true;

    function snapshot() {
      return JSON.stringify({
        title: titleEl.value,
        body: bodyEl.value,
        tags: (document.getElementById('editor-tags') || {}).value || '',
        summary: (document.getElementById('editor-summary') || {}).value || ''
      });
    }

    function tick() {
      if (editor.classList.contains('hidden')) return;
      var snap = snapshot();
      if (snap === lastSavedSnapshot) return;
      // Save to localStorage as a draft (non-destructive)
      try {
        var key = 'bensec-autosave-' + (editor.dataset.editingId || 'new');
        localStorage.setItem(key, snap);
        localStorage.setItem('bensec-autosave-ts', String(Date.now()));
        lastSavedSnapshot = snap;
        if (statusEl) statusEl.textContent = '✓ autosaved ' + new Date().toLocaleTimeString();
      } catch (e) { /* ignore */ }
    }

    if (autosaveTimer) clearInterval(autosaveTimer);
    autosaveTimer = setInterval(tick, 60 * 1000);

    // On editor open, try to restore if newer autosave exists
    var obs = new MutationObserver(function () {
      if (editor.classList.contains('hidden')) return;
      try {
        var key = 'bensec-autosave-' + (editor.dataset.editingId || 'new');
        var saved = localStorage.getItem(key);
        if (!saved) return;
        var d = JSON.parse(saved);
        if (!d || !d.body) return;
        // Only prompt if body differs from current
        if (bodyEl.value && d.body === bodyEl.value) return;
        if (bodyEl.value && !confirm('Restore autosaved changes for this post?')) { localStorage.removeItem(key); return; }
        if (!bodyEl.value && !d.body) return;
        if (titleEl) titleEl.value = d.title || titleEl.value;
        bodyEl.value = d.body || bodyEl.value;
      } catch (e) { /* ignore */ }
    });
    obs.observe(editor, { attributes: true, attributeFilter: ['class'] });
  }

  // ── feat: word count progress ring ──
  var TARGET_KEY = 'bensec-word-target';
  function initWordCountGoal() {
    var bodyEl = document.getElementById('editor-body');
    var footer = document.querySelector('#post-editor .editor-footer-bar');
    if (!bodyEl || !footer || footer.__wcGoal) return;
    footer.__wcGoal = true;

    var target = parseInt(localStorage.getItem(TARGET_KEY) || '600', 10);

    var wrap = document.createElement('span');
    wrap.className = 'wc-goal';
    wrap.innerHTML =
      '<span class="wc-ring-wrap">' +
        '<svg width="20" height="20" class="wc-ring" viewBox="0 0 20 20">' +
          '<circle cx="10" cy="10" r="8" class="wc-ring-bg"></circle>' +
          '<circle cx="10" cy="10" r="8" class="wc-ring-fg"></circle>' +
        '</svg>' +
      '</span>' +
      '<span class="wc-goal-label">0 / ' + target + '</span>' +
      '<button type="button" class="wc-goal-edit" title="Change word target">⚙</button>';
    footer.appendChild(wrap);

    var ring = wrap.querySelector('.wc-ring-fg');
    var label = wrap.querySelector('.wc-goal-label');

    function update() {
      var n = (bodyEl.value || '').trim() ? (bodyEl.value || '').trim().split(/\s+/).length : 0;
      var pct = Math.min(100, (n / target) * 100);
      var circ = 2 * Math.PI * 8;
      ring.setAttribute('stroke-dasharray', circ);
      ring.setAttribute('stroke-dashoffset', circ * (1 - pct / 100));
      label.textContent = n + ' / ' + target;
      wrap.classList.toggle('wc-done', n >= target);
    }
    bodyEl.addEventListener('input', update);
    update();

    wrap.querySelector('.wc-goal-edit').addEventListener('click', function () {
      var v = prompt('Word count target:', target);
      var n = parseInt(v, 10);
      if (n > 0) {
        target = n;
        localStorage.setItem(TARGET_KEY, String(n));
        update();
      }
    });
  }

  // ── feat: paste-image from clipboard in editor ──
  function initPasteImage() {
    var bodyEl = document.getElementById('editor-body');
    if (!bodyEl || bodyEl.__pasteHook) return;
    bodyEl.__pasteHook = true;
    bodyEl.addEventListener('paste', function (e) {
      if (!e.clipboardData) return;
      var items = e.clipboardData.items || [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.kind === 'file' && /^image\//.test(it.type)) {
          e.preventDefault();
          var file = it.getAsFile();
          if (!file) continue;
          var reader = new FileReader();
          reader.onload = function () {
            var dataUrl = reader.result;
            var start = bodyEl.selectionStart, end = bodyEl.selectionEnd;
            var md = '![pasted image](' + dataUrl + ')\n';
            bodyEl.value = bodyEl.value.slice(0, start) + md + bodyEl.value.slice(end);
            bodyEl.selectionStart = bodyEl.selectionEnd = start + md.length;
            bodyEl.dispatchEvent(new Event('input', { bubbles: true }));
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    });
  }

  // ── feat: unsaved-changes warning ──
  function initDirtyWarn() {
    var editor = document.getElementById('post-editor');
    var bodyEl = document.getElementById('editor-body');
    var titleEl = document.getElementById('editor-title');
    if (!editor || !bodyEl || !titleEl) return;
    if (editor.__dirtyInit) return;
    editor.__dirtyInit = true;

    var initial = '';
    function reset() { initial = titleEl.value + '\n' + bodyEl.value; }
    function dirty() { return (titleEl.value + '\n' + bodyEl.value) !== initial; }

    var obs = new MutationObserver(function () { if (!editor.classList.contains('hidden')) reset(); });
    obs.observe(editor, { attributes: true, attributeFilter: ['class'] });
    reset();

    window.addEventListener('beforeunload', function (e) {
      if (!editor.classList.contains('hidden') && dirty()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
    // Intercept save buttons to reset state
    ['save-post-btn', 'save-draft-btn'].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.addEventListener('click', function () { setTimeout(reset, 200); });
    });
  }

  // ── feat: inline row actions — disabled, main admin UI has these buttons ──
  function initInlineActions() { return; // main UI already has toggle/delete
    var list = document.getElementById('posts-list');
    if (!list || list.__inlineInit) return;
    list.__inlineInit = true;

    function inject() {
      list.querySelectorAll('.admin-post-row, .admin-post-item').forEach(function (row) {
        if (row.querySelector('.inline-actions')) return;
        var id = row.dataset.id || (row.querySelector('[data-id]') && row.querySelector('[data-id]').dataset.id);
        if (!id) return;
        var posts = BensecDB.getPosts() || [];
        var post = posts.find(function (p) { return p.id === id; });
        if (!post) return;

        var wrap = document.createElement('div');
        wrap.className = 'inline-actions';
        wrap.innerHTML =
          '<button class="inline-btn" data-action="toggle" title="Toggle draft/published">' +
            (post.status === 'draft' ? '▶ publish' : '⏸ draft') +
          '</button>' +
          '<button class="inline-btn danger" data-action="delete" title="Delete post">✕</button>';
        row.appendChild(wrap);
        wrap.addEventListener('click', function (e) {
          var btn = e.target.closest('.inline-btn');
          if (!btn) return;
          e.stopPropagation();
          var act = btn.dataset.action;
          if (act === 'delete') {
            if (!confirm('Delete "' + (post.title || 'untitled') + '"?')) return;
            BensecDB.deletePost(id);
            row.style.opacity = '0.3';
            setTimeout(function () { location.reload(); }, 400);
          } else if (act === 'toggle') {
            post.status = post.status === 'draft' ? 'published' : 'draft';
            post.__skipUpdated = true;
            BensecDB.savePost(post);
            setTimeout(function () { location.reload(); }, 300);
          }
        });
      });
    }
    var mo = new MutationObserver(inject);
    mo.observe(list, { childList: true, subtree: false });
    inject();
  }

  // ── feat: OG image generator ──
  function generateOgImage(post) {
    var canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 630;
    var ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 1200, 630);
    // Subtle green grid
    ctx.strokeStyle = 'rgba(0,255,140,0.06)';
    ctx.lineWidth = 1;
    for (var x = 0; x < 1200; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 630); ctx.stroke(); }
    for (var y = 0; y < 630; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1200, y); ctx.stroke(); }
    // Glow
    var grad = ctx.createRadialGradient(600, 315, 100, 600, 315, 500);
    grad.addColorStop(0, 'rgba(0,255,140,0.12)');
    grad.addColorStop(1, 'rgba(0,255,140,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 630);

    // Branding top-left
    ctx.fillStyle = '#00ff8c';
    ctx.font = 'bold 28px "Fira Code", monospace';
    ctx.fillText('> bensec', 60, 70);

    // Label
    ctx.fillStyle = 'rgba(0,255,140,0.7)';
    ctx.font = '20px "Fira Code", monospace';
    ctx.fillText('// blog post', 60, 180);

    // Title — wrap
    ctx.fillStyle = '#e6edf3';
    ctx.font = 'bold 58px "Fira Code", monospace';
    wrapText(ctx, post.title || '(untitled)', 60, 260, 1080, 72, 4);

    // Tags bottom
    ctx.fillStyle = '#00ff8c';
    ctx.font = '22px "Fira Code", monospace';
    ctx.fillText(((post.tags || []).slice(0, 5).map(function (t) { return '#' + t; }).join('  ')) || '', 60, 560);

    ctx.fillStyle = 'rgba(230,237,243,0.5)';
    ctx.font = '20px "Fira Code", monospace';
    ctx.fillText(post.date || '', 60, 600);

    return canvas.toDataURL('image/png');
  }
  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    var words = String(text).split(' ');
    var line = '';
    var lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i] + ' ';
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = words[i] + ' ';
        if (lines.length >= maxLines) break;
      } else line = test;
    }
    if (lines.length < maxLines) lines.push(line);
    lines.slice(0, maxLines).forEach(function (l, i) {
      ctx.fillText(l.trim(), x, y + i * lineHeight);
    });
  }

  function addOgImageButton() {
    var actions = document.querySelector('#post-editor .editor-actions');
    if (!actions || actions.querySelector('#og-image-btn')) return;
    var b = document.createElement('button');
    b.id = 'og-image-btn';
    b.className = 'admin-btn';
    b.type = 'button';
    b.textContent = '🖼 og image';
    b.title = 'Generate a 1200×630 social preview image for this post';
    var pvw = actions.querySelector('#preview-post-btn');
    if (pvw) actions.insertBefore(b, pvw.nextSibling); else actions.appendChild(b);
    b.addEventListener('click', function () {
      var post = {
        title: (document.getElementById('editor-title') || {}).value || '',
        tags: ((document.getElementById('editor-tags') || {}).value || '').split(/\s+/).filter(Boolean),
        date: (document.getElementById('editor-date') || {}).value || ''
      };
      var url = generateOgImage(post);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'og-' + (post.title || 'post').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png';
      a.click();
    });
  }

  // ── feat: sitemap + RSS download ──
  function addSitemapRssButtons() {
    var bar = document.querySelector('.admin-topbar-right');
    if (!bar || bar.querySelector('#download-sitemap-btn')) return;

    var sm = document.createElement('button');
    sm.id = 'download-sitemap-btn';
    sm.className = 'admin-btn ghost';
    sm.title = 'Download sitemap.xml based on current posts';
    sm.textContent = '🗺';
    sm.addEventListener('click', function () {
      var posts = (BensecDB.getPosts() || []).filter(function (p) { return p.status !== 'draft'; });
      var base = 'https://ben-hawarden-blog.web.app';
      var staticUrls = ['/', '/blog.html', '/cheatsheets.html', '/resources.html', '/now.html', '/uses.html', '/archive.html', '/tags.html'];
      var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        staticUrls.map(function (u) {
          return '  <url><loc>' + base + u + '</loc><changefreq>weekly</changefreq></url>';
        }).join('\n') + '\n' +
        posts.map(function (p) {
          var d = (p.updated || p.date || '').trim();
          return '  <url>' +
            '<loc>' + base + '/post.html?id=' + encodeURIComponent(p.id) + '</loc>' +
            (d ? '<lastmod>' + d + '</lastmod>' : '') +
            '</url>';
        }).join('\n') + '\n</urlset>\n';
      download('sitemap.xml', xml, 'application/xml');
    });
    bar.insertBefore(sm, bar.firstChild);

    var rss = document.createElement('button');
    rss.id = 'download-rss-btn';
    rss.className = 'admin-btn ghost';
    rss.title = 'Download feed.xml (RSS) based on current posts';
    rss.textContent = '📡';
    rss.addEventListener('click', function () {
      var posts = (BensecDB.getPosts() || []).filter(function (p) { return p.status !== 'draft'; })
        .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      var base = 'https://ben-hawarden-blog.web.app';
      var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<rss version="2.0"><channel>\n' +
        '<title>bensec — Ben Hawarden</title>\n' +
        '<link>' + base + '/</link>\n' +
        '<description>CTF writeups, security notes, and things I\'ve learned.</description>\n' +
        posts.map(function (p) {
          return '<item>' +
            '<title>' + xe(p.title || '') + '</title>' +
            '<link>' + base + '/post.html?id=' + encodeURIComponent(p.id) + '</link>' +
            '<guid>' + base + '/post.html?id=' + encodeURIComponent(p.id) + '</guid>' +
            (p.date ? '<pubDate>' + new Date(p.date).toUTCString() + '</pubDate>' : '') +
            '<description>' + xe(p.summary || '') + '</description>' +
            '</item>';
        }).join('\n') +
        '\n</channel></rss>\n';
      download('feed.xml', xml, 'application/rss+xml');
    });
    bar.insertBefore(rss, bar.firstChild);
  }
  function xe(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  function init() {
    var dash = document.getElementById('admin-dashboard');
    if (!dash || dash.classList.contains('hidden')) return;
    initInlineActions();
    addSitemapRssButtons();
  }
  function initEditorFeatures() {
    var editor = document.getElementById('post-editor');
    if (!editor || editor.classList.contains('hidden')) return;
    initTagAutocomplete();
    initAutosave();
    initWordCountGoal();
    initPasteImage();
    initDirtyWarn();
    addOgImageButton();
  }

  var dashObs = new MutationObserver(init);
  var dash = document.getElementById('admin-dashboard');
  if (dash) dashObs.observe(dash, { attributes: true, attributeFilter: ['class'] });

  var edObs = new MutationObserver(initEditorFeatures);
  var ed = document.getElementById('post-editor');
  if (ed) edObs.observe(ed, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('DOMContentLoaded', function () { init(); initEditorFeatures(); });
  setTimeout(function () { init(); initEditorFeatures(); }, 800);
  setTimeout(function () { init(); initEditorFeatures(); }, 2000);
}());
