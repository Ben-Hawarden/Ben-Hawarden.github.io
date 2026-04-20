// ── Admin extras 6 ──
// feat: autosave, save-in-place button, Ctrl+S saves without closing editor
// feat: code block folding in the editor textarea
(function () {
  'use strict';

  if (!/admin\.html/i.test(location.pathname) && !document.getElementById('admin-dashboard')) return;

  var AUTOSAVE_INTERVAL = 30000; // 30 seconds
  var autosaveTimer = null;
  var isDirty = false;
  var lastSavedAt = null;
  var saveBtn = null;

  // ── Status helpers ──
  function getStatusEl() {
    return document.getElementById('autosave-status');
  }

  function setStatus(text, cls) {
    var el = getStatusEl();
    if (!el) return;
    el.textContent = text;
    el.className = 'editor-autosave-status' + (cls ? ' ' + cls : '');
  }

  function timeSince(ts) {
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 5)  return 'just now';
    if (s < 60) return s + 's ago';
    return Math.round(s / 60) + 'm ago';
  }

  // ── Core save (auto-unfolds code blocks first) ──
  function saveNow(silent) {
    if (!window._adminSaveInPlace) return;
    var editorEl = document.getElementById('post-editor');
    if (!editorEl || editorEl.classList.contains('hidden')) return;

    var title = (document.getElementById('editor-title') || {}).value || '';
    if (!title.trim()) {
      if (!silent) setStatus('title required', 'status-error');
      return;
    }

    // Always unfold before saving so real code is stored
    unfoldAll(true);

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'saving…';
    }
    setStatus('saving…', 'status-saving');

    var ok = window._adminSaveInPlace('draft');
    if (ok !== false) {
      isDirty = false;
      lastSavedAt = Date.now();
      setStatus('saved ' + timeSince(lastSavedAt), 'status-saved');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 save';
      }
    } else {
      setStatus('', '');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 save';
      }
    }
  }

  // ── Dirty tracking ──
  function markDirty() {
    if (!isDirty) {
      isDirty = true;
      setStatus('unsaved changes', 'status-dirty');
    }
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(function () { saveNow(true); }, AUTOSAVE_INTERVAL);
  }

  function attachDirtyTracking() {
    var fields = ['editor-title', 'editor-body', 'editor-tags', 'editor-summary', 'editor-date', 'editor-status'];
    fields.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.dataset.dirtyBound) {
        el.dataset.dirtyBound = '1';
        el.addEventListener('input', markDirty);
        el.addEventListener('change', markDirty);
      }
    });
  }

  // ── Save button ──
  function injectSaveButton() {
    var headerActions = document.querySelector('#post-editor .editor-header-actions');
    if (!headerActions || headerActions.querySelector('.admin-autosave-btn')) return;

    saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'admin-btn admin-autosave-btn';
    saveBtn.textContent = '💾 save';
    saveBtn.title = 'Save draft (Ctrl+S)';
    saveBtn.addEventListener('click', function () { saveNow(false); });

    var statusEl = headerActions.querySelector('#autosave-status');
    if (statusEl) {
      headerActions.insertBefore(saveBtn, statusEl);
    } else {
      headerActions.insertBefore(saveBtn, headerActions.firstChild);
    }
  }

  // ══════════════════════════════════
  //  CODE BLOCK FOLDING
  // ══════════════════════════════════

  var foldedBlocks = {};   // index → { lang, code }
  var foldActive   = false;

  var TOKEN_RE = /^\[\[cb:(\d+):?([^\]]*)\]\]$/;

  function tokenFor(i, lang) {
    return '[[cb:' + i + (lang ? ':' + lang : '') + ']]';
  }

  // Parse textarea for fenced code blocks
  function parseBlocks(text) {
    var blocks = [];
    var re = /```([^\n`]*)\n([\s\S]*?)```/g;
    var match;
    while ((match = re.exec(text)) !== null) {
      blocks.push({
        full:  match[0],
        lang:  (match[1] || '').trim(),
        code:  match[2],
        start: match.index,
        end:   re.lastIndex
      });
    }
    return blocks;
  }

  function foldAll() {
    var textarea = document.getElementById('editor-body');
    if (!textarea) return;

    // Clear previous fold state
    foldedBlocks = {};
    var text = textarea.value;
    var blocks = parseBlocks(text);
    if (!blocks.length) return;

    // Replace from end to start so indices don't shift
    for (var i = blocks.length - 1; i >= 0; i--) {
      var b = blocks[i];
      foldedBlocks[i] = { lang: b.lang, code: b.code, full: b.full };
      text = text.slice(0, b.start) + tokenFor(i, b.lang) + text.slice(b.end);
    }

    textarea.value = text;
    foldActive = true;
    renderFoldPanel();
    updateFoldBtn();
  }

  function unfoldAll(silent) {
    if (!foldActive && !silent) return;
    var textarea = document.getElementById('editor-body');
    if (!textarea) return;

    var text = textarea.value;
    // Replace tokens with real code (in any order — use global replace)
    text = text.replace(/\[\[cb:(\d+):?([^\]]*)\]\]/g, function (_, idx) {
      var b = foldedBlocks[parseInt(idx, 10)];
      return b ? b.full : _;
    });

    textarea.value = text;
    foldActive = false;
    foldedBlocks = {};
    removeFoldPanel();
    updateFoldBtn();
  }

  function expandBlock(idx) {
    var textarea = document.getElementById('editor-body');
    if (!textarea) return;
    var b = foldedBlocks[idx];
    if (!b) return;

    var token = tokenFor(idx, b.lang);
    textarea.value = textarea.value.replace(token, b.full);
    delete foldedBlocks[idx];

    // If no more folded blocks, deactivate
    if (Object.keys(foldedBlocks).length === 0) {
      foldActive = false;
      removeFoldPanel();
      updateFoldBtn();
    } else {
      renderFoldPanel();
    }
  }

  function renderFoldPanel() {
    var container = document.getElementById('code-fold-panel');
    if (!container) {
      container = document.createElement('div');
      container.id = 'code-fold-panel';
      container.className = 'code-fold-panel';
      var writePanel = document.getElementById('write-panel');
      var toolbar = writePanel && writePanel.querySelector('.editor-toolbar');
      if (toolbar && toolbar.parentNode) {
        toolbar.parentNode.insertBefore(container, toolbar.nextSibling);
      }
    }

    var keys = Object.keys(foldedBlocks).map(Number).sort(function (a, b) { return a - b; });

    container.innerHTML =
      '<div class="fold-panel-header">' +
        '<span class="fold-panel-label">// ' + keys.length + ' folded code block' + (keys.length !== 1 ? 's' : '') + '</span>' +
        '<button type="button" class="fold-unfold-all-btn admin-btn" id="unfold-all-btn">⊞ unfold all</button>' +
      '</div>' +
      '<div class="fold-panel-list">' +
        keys.map(function (i) {
          var b = foldedBlocks[i];
          var lines = b.code.split('\n').length;
          return '<div class="fold-block-item">' +
            '<span class="fold-block-lang">' + (b.lang || 'code') + '</span>' +
            '<span class="fold-block-lines">' + lines + ' lines</span>' +
            '<button type="button" class="admin-btn fold-expand-btn" data-idx="' + i + '">expand</button>' +
          '</div>';
        }).join('') +
      '</div>';

    container.querySelector('#unfold-all-btn').addEventListener('click', function () { unfoldAll(false); });
    container.querySelectorAll('.fold-expand-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { expandBlock(parseInt(btn.dataset.idx, 10)); });
    });
  }

  function removeFoldPanel() {
    var panel = document.getElementById('code-fold-panel');
    if (panel) panel.remove();
  }

  function updateFoldBtn() {
    var btn = document.getElementById('fold-code-btn');
    if (!btn) return;
    if (foldActive) {
      btn.textContent = '⊞ unfold code';
      btn.classList.add('active');
    } else {
      btn.textContent = '⊟ fold code';
      btn.classList.remove('active');
    }
  }

  function injectFoldButton() {
    var toolbar = document.querySelector('#write-panel .editor-toolbar');
    if (!toolbar || toolbar.querySelector('#fold-code-btn')) return;

    // Add a separator then the fold button
    var sep = document.createElement('span');
    sep.className = 'toolbar-sep';
    sep.textContent = '|';
    toolbar.appendChild(sep);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fold-code-btn';
    btn.className = 'toolbar-btn';
    btn.textContent = '⊟ fold code';
    btn.title = 'Collapse all code blocks so they\'re easier to work around';
    btn.addEventListener('click', function () {
      if (foldActive) unfoldAll(false);
      else foldAll();
    });
    toolbar.appendChild(btn);
  }

  // ── Reset state when editor opens/closes ──
  function onEditorOpen() {
    isDirty = false;
    lastSavedAt = null;
    clearTimeout(autosaveTimer);
    setStatus('', '');
    injectSaveButton();
    injectFoldButton();
    attachDirtyTracking();
    // Reset fold state for new post
    foldedBlocks = {};
    foldActive = false;
    removeFoldPanel();
    updateFoldBtn();
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 save';
    }
  }

  function onEditorClose() {
    isDirty = false;
    clearTimeout(autosaveTimer);
    setStatus('', '');
    unfoldAll(true); // always restore before leaving
  }

  // Update "saved X ago" text every 30s
  setInterval(function () {
    if (!isDirty && lastSavedAt) {
      setStatus('saved ' + timeSince(lastSavedAt), 'status-saved');
    }
  }, 30000);

  // ── Watch for editor visibility changes ──
  function watchEditor() {
    var editorEl = document.getElementById('post-editor');
    if (!editorEl) return;

    var wasHidden = editorEl.classList.contains('hidden');
    var observer = new MutationObserver(function () {
      var hidden = editorEl.classList.contains('hidden');
      if (wasHidden && !hidden) { onEditorOpen(); }
      else if (!wasHidden && hidden) { onEditorClose(); }
      wasHidden = hidden;
    });
    observer.observe(editorEl, { attributes: true, attributeFilter: ['class'] });

    if (!wasHidden) onEditorOpen();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var tries = 0;
    (function waitReady() {
      var dash = document.getElementById('admin-dashboard');
      var ready = dash && !dash.classList.contains('hidden') && window._adminSaveInPlace;
      if (ready || tries++ > 80) {
        watchEditor();
        injectSaveButton();
        injectFoldButton();
        attachDirtyTracking();
      } else {
        setTimeout(waitReady, 150);
      }
    }());
  });

  setTimeout(function () {
    watchEditor();
    injectSaveButton();
    injectFoldButton();
    attachDirtyTracking();
  }, 2000);

}());
