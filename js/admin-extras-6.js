// ── Admin extras 6 ──
// feat: autosave, save-in-place button, Ctrl+S saves without closing editor
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

  // ── Core save ──
  function saveNow(silent) {
    if (!window._adminSaveInPlace) return;
    var editorEl = document.getElementById('post-editor');
    if (!editorEl || editorEl.classList.contains('hidden')) return;

    var title = (document.getElementById('editor-title') || {}).value || '';
    if (!title.trim()) {
      if (!silent) setStatus('title required', 'status-error');
      return;
    }

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
    // Reset autosave countdown
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

    // Insert as first item in header-actions (before the status span)
    var statusEl = headerActions.querySelector('#autosave-status');
    if (statusEl) {
      headerActions.insertBefore(saveBtn, statusEl);
    } else {
      headerActions.insertBefore(saveBtn, headerActions.firstChild);
    }
  }

  // ── Reset state when editor opens/closes ──
  function onEditorOpen() {
    isDirty = false;
    lastSavedAt = null;
    clearTimeout(autosaveTimer);
    setStatus('', '');
    injectSaveButton();
    attachDirtyTracking();
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 save';
    }
  }

  function onEditorClose() {
    isDirty = false;
    clearTimeout(autosaveTimer);
    setStatus('', '');
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

    // If editor is already open on load
    if (!wasHidden) onEditorOpen();
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Wait for admin to be ready
    var tries = 0;
    (function waitReady() {
      var dash = document.getElementById('admin-dashboard');
      var ready = dash && !dash.classList.contains('hidden') && window._adminSaveInPlace;
      if (ready || tries++ > 80) {
        watchEditor();
        injectSaveButton();
        attachDirtyTracking();
      } else {
        setTimeout(waitReady, 150);
      }
    }());
  });

  // Also retry after auth completes
  setTimeout(function () {
    watchEditor();
    injectSaveButton();
    attachDirtyTracking();
  }, 2000);

}());
