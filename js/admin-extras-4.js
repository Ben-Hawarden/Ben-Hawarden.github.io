// ── Admin extras 4 ──
// feat: quick open-in-tab from post list, reading ease score in editor,
// markdown toolbar buttons, image manager panel, draft preview token
(function () {
  'use strict';

  if (!/admin\.html/i.test(location.pathname) && !document.getElementById('admin-dashboard')) return;

  // ── feat: quick open-in-tab on post rows ──
  function initQuickOpen() {
    var list = document.getElementById('posts-list');
    if (!list || list.__quickOpenInit) return;
    list.__quickOpenInit = true;

    function inject() {
      list.querySelectorAll('.admin-post-row, .admin-post-item').forEach(function (row) {
        if (row.querySelector('.quick-open-btn')) return;
        var id = row.dataset.id; if (!id) return;
        var btn = document.createElement('a');
        btn.className = 'inline-btn quick-open-btn';
        btn.href = 'post.html?id=' + encodeURIComponent(id);
        btn.target = '_blank';
        btn.rel = 'noopener';
        btn.title = 'Open live post in new tab';
        btn.textContent = '↗';
        btn.setAttribute('aria-label', 'Open post in new tab');
        var ia = row.querySelector('.inline-actions');
        if (ia) ia.insertBefore(btn, ia.firstChild);
        else row.appendChild(btn);
      });
    }
    var mo = new MutationObserver(inject);
    mo.observe(list, { childList: true });
    inject();
  }

  // ── feat: reading ease score (Flesch-Kincaid) ──
  function fleschScore(text) {
    if (!text || !text.trim()) return null;
    var sentences = (text.match(/[.!?]+/g) || []).length || 1;
    var words = text.trim().split(/\s+/).length;
    var syllables = text.toLowerCase().split(/\s+/).reduce(function (total, word) {
      word = word.replace(/[^a-z]/g, '');
      if (!word) return total;
      var count = word.match(/[aeiouy]+/g);
      var n = count ? count.length : 1;
      if (word.endsWith('e') && n > 1) n--;
      return total + Math.max(1, n);
    }, 0);
    var score = Math.round(206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words));
    score = Math.max(0, Math.min(100, score));
    var label = score >= 70 ? 'Easy' : score >= 50 ? 'Standard' : score >= 30 ? 'Difficult' : 'Very difficult';
    return { score: score, label: label };
  }

  function initReadingEase() {
    var bodyEl = document.getElementById('editor-body');
    var footer = document.querySelector('#post-editor .editor-footer-bar');
    if (!bodyEl || !footer || footer.__fleschInit) return;
    footer.__fleschInit = true;

    var badge = document.createElement('span');
    badge.className = 'flesch-badge';
    badge.title = 'Flesch reading ease score (higher = easier to read)';
    footer.appendChild(badge);

    function update() {
      var r = fleschScore(bodyEl.value || '');
      if (!r) { badge.textContent = ''; return; }
      badge.textContent = 'readability: ' + r.score + ' — ' + r.label;
      badge.className = 'flesch-badge flesch-' + r.label.toLowerCase().replace(/\s+/g, '-');
    }
    bodyEl.addEventListener('input', update);
    update();
  }

  // ── feat: markdown toolbar ──
  function initMarkdownToolbar() {
    var bodyEl = document.getElementById('editor-body');
    var toolbar = document.querySelector('#post-editor .editor-toolbar');
    if (!bodyEl || !toolbar || toolbar.querySelector('.md-toolbar-btns')) return;

    var sep = document.createElement('span');
    sep.className = 'toolbar-sep';
    sep.textContent = '|';
    toolbar.appendChild(sep);

    var grp = document.createElement('span');
    grp.className = 'md-toolbar-btns toolbar-label';
    grp.textContent = 'format:';
    toolbar.appendChild(grp);

    var actions = [
      { label: 'B',    title: 'Bold',          wrap: '**',   block: false },
      { label: 'I',    title: 'Italic',         wrap: '_',    block: false },
      { label: '`',    title: 'Inline code',    wrap: '`',    block: false },
      { label: '~~',   title: 'Strikethrough',  wrap: '~~',   block: false },
      { label: '"',    title: 'Blockquote',     prefix: '> ', block: true },
      { label: '—',    title: 'Horizontal rule',insert: '\n\n---\n\n', block: false },
      { label: '[]',   title: 'Link',           template: '[${sel}](url)', block: false },
      { label: 'h2',   title: 'Heading 2',      prefix: '## ', block: true },
      { label: 'h3',   title: 'Heading 3',      prefix: '### ', block: true },
    ];

    actions.forEach(function (act) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toolbar-btn md-btn';
      btn.textContent = act.label;
      btn.title = act.title;
      btn.addEventListener('click', function () { applyFormat(bodyEl, act); });
      toolbar.appendChild(btn);
    });
  }

  function applyFormat(el, act) {
    var start = el.selectionStart, end = el.selectionEnd;
    var val = el.value;
    var sel = val.slice(start, end);
    var replacement;

    if (act.insert) {
      replacement = act.insert;
      el.value = val.slice(0, start) + replacement + val.slice(end);
      el.selectionStart = el.selectionEnd = start + replacement.length;
    } else if (act.template) {
      replacement = act.template.replace('${sel}', sel || 'text');
      el.value = val.slice(0, start) + replacement + val.slice(end);
      el.selectionStart = start;
      el.selectionEnd = start + replacement.length;
    } else if (act.prefix) {
      var lines = (sel || 'text').split('\n').map(function (l) { return act.prefix + l; }).join('\n');
      el.value = val.slice(0, start) + lines + val.slice(end);
      el.selectionStart = start;
      el.selectionEnd = start + lines.length;
    } else if (act.wrap) {
      var w = act.wrap;
      // Toggle: if already wrapped, unwrap; else wrap
      if (sel.startsWith(w) && sel.endsWith(w) && sel.length > w.length * 2) {
        replacement = sel.slice(w.length, sel.length - w.length);
      } else {
        replacement = w + (sel || 'text') + w;
      }
      el.value = val.slice(0, start) + replacement + val.slice(end);
      el.selectionStart = start + w.length;
      el.selectionEnd = start + replacement.length - w.length;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }

  // ── feat: image manager ──
  function initImageManager() {
    var actions = document.querySelector('#post-editor .editor-actions');
    if (!actions || actions.querySelector('#img-manager-btn')) return;

    var btn = document.createElement('button');
    btn.id = 'img-manager-btn';
    btn.type = 'button';
    btn.className = 'admin-btn';
    btn.textContent = '🗂 images';
    btn.title = 'View all images used in this post';
    actions.appendChild(btn);

    var modal = document.createElement('div');
    modal.id = 'img-manager-modal';
    modal.className = 'admin-modal hidden';
    modal.innerHTML =
      '<div class="admin-modal-content img-manager-content">' +
        '<h3>Image manager</h3>' +
        '<p class="dim" style="font-size:12px;margin-bottom:1rem;">All images found in the current post body.</p>' +
        '<div id="img-manager-grid" class="img-manager-grid"></div>' +
        '<div class="admin-modal-actions"><button class="admin-btn" id="img-manager-close">close</button></div>' +
      '</div>';
    document.body.appendChild(modal);

    document.getElementById('img-manager-close').addEventListener('click', function () { modal.classList.add('hidden'); });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.classList.add('hidden'); });

    btn.addEventListener('click', function () {
      var bodyEl = document.getElementById('editor-body');
      var grid = document.getElementById('img-manager-grid');
      if (!bodyEl || !grid) return;
      var text = bodyEl.value || '';
      // Find ![]() markdown images and <img src=""> HTML
      var found = [];
      text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (_, alt, src) { found.push({ alt: alt, src: src }); });
      text.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/g, function (_, src) { found.push({ alt: '', src: src }); });

      if (!found.length) {
        grid.innerHTML = '<p class="dim">No images found in post body.</p>';
      } else {
        grid.innerHTML = found.map(function (img, i) {
          var isBase64 = img.src.startsWith('data:');
          var sizeNote = isBase64 ? '<span class="img-size-warn">⚠ base64 — large file size</span>' : '';
          return '<div class="img-manager-item">' +
            '<img src="' + escH(img.src) + '" alt="' + escH(img.alt) + '" loading="lazy">' +
            '<div class="img-manager-meta">' +
              '<span class="img-alt">' + (img.alt || '(no alt)') + '</span>' +
              sizeNote +
              '<a class="inline-btn" href="' + escH(img.src) + '" target="_blank" rel="noopener">↗ open</a>' +
            '</div>' +
          '</div>';
        }).join('');
      }
      modal.classList.remove('hidden');
    });
  }

  // ── feat: draft preview token ──
  function initDraftPreview() {
    var actions = document.querySelector('#post-editor .editor-actions');
    if (!actions || actions.querySelector('#draft-preview-btn')) return;

    var btn = document.createElement('button');
    btn.id = 'draft-preview-btn';
    btn.type = 'button';
    btn.className = 'admin-btn';
    btn.textContent = '🔗 share preview';
    btn.title = 'Generate a shareable preview link for this draft';
    actions.appendChild(btn);

    btn.addEventListener('click', function () {
      // Store current draft in sessionStorage with a random token
      var editor = document.getElementById('post-editor');
      var token = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      var data = {
        id:      '__preview__',
        title:   (document.getElementById('editor-title') || {}).value || '',
        body:    (document.getElementById('editor-body') || {}).value || '',
        tags:    ((document.getElementById('editor-tags') || {}).value || '').split(/\s+/).filter(Boolean),
        summary: (document.getElementById('editor-summary') || {}).value || '',
        date:    (document.getElementById('editor-date') || {}).value || new Date().toISOString().slice(0, 10),
        status:  'published' // preview shows as published
      };
      try {
        sessionStorage.setItem('preview-post-' + token, JSON.stringify(data));
      } catch (e) { alert('sessionStorage unavailable.'); return; }
      var url = location.origin + '/post.html?preview=' + token;
      navigator.clipboard && navigator.clipboard.writeText(url).then(function () {
        btn.textContent = '✓ link copied!';
        setTimeout(function () { btn.textContent = '🔗 share preview'; }, 2500);
      }).catch(function () {
        prompt('Copy this preview URL:', url);
      });
    });
  }

  function escH(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function init() {
    var dash = document.getElementById('admin-dashboard');
    if (!dash || dash.classList.contains('hidden')) return;
    initQuickOpen();
  }

  function initEditorFeatures() {
    var ed = document.getElementById('post-editor');
    if (!ed || ed.classList.contains('hidden')) return;
    initReadingEase();
    initMarkdownToolbar();
    initImageManager();
    initDraftPreview();
  }

  var dashObs = new MutationObserver(init);
  var dash = document.getElementById('admin-dashboard');
  if (dash) dashObs.observe(dash, { attributes: true, attributeFilter: ['class'] });

  var edObs = new MutationObserver(initEditorFeatures);
  var ed = document.getElementById('post-editor');
  if (ed) edObs.observe(ed, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 400); setTimeout(initEditorFeatures, 800); });
  setTimeout(function () { init(); initEditorFeatures(); }, 1500);
  setTimeout(function () { init(); initEditorFeatures(); }, 3000);

  // Inject quick-open also from post list mutations
  var listObs = new MutationObserver(function () { initQuickOpen(); });
  var postList = document.getElementById('posts-list');
  if (postList) listObs.observe(postList, { childList: true });
}());
