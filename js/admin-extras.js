// ── Admin extras ──
// Adds: bulk actions, revision history, analytics tab — on top of blog-engine.js
(function () {
  'use strict';

  if (!/admin\.html/i.test(location.pathname) && !document.getElementById('admin-dashboard')) return;

  // ── feat: wrap savePost to auto-stamp 'updated' + push revisions ──
  function wrapSavePost() {
    if (!window.BensecDB || !BensecDB.savePost || BensecDB.__wrapped) return false;
    var origSave = BensecDB.savePost;
    BensecDB.savePost = function (post) {
      try {
        var existing = (BensecDB.getPosts() || []).find(function (p) { return p.id === post.id; });
        if (existing) {
          // Stamp 'updated' if body changed
          if (existing.body !== post.body && !post.__skipUpdated) {
            var today = new Date();
            var yyyy = today.getFullYear();
            var mm = String(today.getMonth() + 1).padStart(2, '0');
            var dd = String(today.getDate()).padStart(2, '0');
            post.updated = yyyy + '-' + mm + '-' + dd;
          } else if (existing.updated && !post.updated) {
            post.updated = existing.updated;
          }
          // Push snapshot of OLD state into revisions (keep last 5)
          if (existing.body !== post.body || existing.title !== post.title) {
            var revs = (existing.revisions || []).slice();
            revs.unshift({
              ts: Date.now(),
              title: existing.title,
              body: existing.body
            });
            post.revisions = revs.slice(0, 5);
          } else {
            post.revisions = existing.revisions || [];
          }
        }
      } catch (e) { /* fall through */ }
      delete post.__skipUpdated;
      return origSave.call(BensecDB, post);
    };
    BensecDB.__wrapped = true;
    return true;
  }

  // Try wrapping as soon as possible, and keep retrying
  (function tryWrap(tries) {
    if (wrapSavePost()) return;
    if (tries > 60) return;
    setTimeout(function () { tryWrap(tries + 1); }, 100);
  }(0));

  // ── feat: bulk actions on posts list ──
  // NOTE: disabled — admin-extras-3.js has the canonical implementation
  function initBulkActions() { return; // superseded by admin-extras-3
    var list = document.getElementById('posts-list');
    var panel = document.getElementById('posts-panel');
    if (!list || !panel) return;

    // Insert bulk bar (hidden by default)
    var bar = document.createElement('div');
    bar.id = 'bulk-action-bar';
    bar.className = 'bulk-action-bar hidden';
    bar.innerHTML =
      '<span class="bulk-count">0 selected</span>' +
      '<button class="admin-btn success" data-bulk="publish">publish</button>' +
      '<button class="admin-btn" data-bulk="unpublish">unpublish</button>' +
      '<button class="admin-btn danger" data-bulk="delete">delete</button>' +
      '<button class="admin-btn ghost" data-bulk="clear">clear selection</button>';
    var toolbar = panel.querySelector('.admin-toolbar');
    if (toolbar && toolbar.nextSibling) toolbar.parentNode.insertBefore(bar, toolbar.nextSibling);
    else panel.insertBefore(bar, list);

    function collectChecked() {
      return Array.from(list.querySelectorAll('input.bulk-check:checked')).map(function (cb) { return cb.dataset.id; });
    }
    function refreshBar() {
      var ids = collectChecked();
      bar.classList.toggle('hidden', ids.length === 0);
      bar.querySelector('.bulk-count').textContent = ids.length + ' selected';
    }

    // Inject checkboxes into each row after render
    function inject() {
      if (!list) return;
      list.querySelectorAll('.admin-post-row, .admin-post-item').forEach(function (row) {
        if (row.querySelector('.bulk-check')) return;
        // Find an id attribute somewhere
        var id = row.dataset.id || row.getAttribute('data-id');
        if (!id) {
          // try to find a delete/edit button with data-id
          var btn = row.querySelector('[data-id]');
          if (btn) id = btn.dataset.id;
        }
        if (!id) return;
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'bulk-check';
        cb.dataset.id = id;
        cb.setAttribute('aria-label', 'Select post for bulk action');
        cb.addEventListener('click', function (e) { e.stopPropagation(); });
        cb.addEventListener('change', refreshBar);
        row.insertBefore(cb, row.firstChild);
      });
    }

    // Observe the posts list for re-renders
    var mo = new MutationObserver(function () { inject(); refreshBar(); });
    mo.observe(list, { childList: true, subtree: false });
    inject();

    bar.addEventListener('click', function (e) {
      var action = e.target.dataset && e.target.dataset.bulk;
      if (!action) return;
      var ids = collectChecked();
      if (action === 'clear') {
        list.querySelectorAll('input.bulk-check:checked').forEach(function (cb) { cb.checked = false; });
        refreshBar();
        return;
      }
      if (!ids.length) return;

      if (action === 'delete' && !confirm('Delete ' + ids.length + ' post(s)? This cannot be undone.')) return;

      var posts = (BensecDB.getPosts() || []).slice();
      if (action === 'delete') {
        posts = posts.filter(function (p) { return ids.indexOf(p.id) === -1; });
      } else if (action === 'publish' || action === 'unpublish') {
        var newStatus = action === 'publish' ? 'published' : 'draft';
        posts.forEach(function (p) { if (ids.indexOf(p.id) !== -1) p.status = newStatus; });
      }
      BensecDB.savePosts(posts);
      setTimeout(function () { location.reload(); }, 300);
    });
  }

  // ── feat: revision history modal ──
  function initRevisionsModal() {
    // Add "history" button into editor toolbar / actions
    var actions = document.querySelector('#post-editor .editor-actions');
    if (!actions || actions.querySelector('#history-btn')) return;

    var btn = document.createElement('button');
    btn.id = 'history-btn';
    btn.className = 'admin-btn';
    btn.type = 'button';
    btn.textContent = '⎌ history';
    btn.title = 'View previous versions of this post';
    // Insert before delete button
    var del = actions.querySelector('#delete-from-editor-btn');
    if (del) actions.insertBefore(btn, del); else actions.appendChild(btn);

    // Modal
    var modal = document.createElement('div');
    modal.id = 'history-modal';
    modal.className = 'admin-modal hidden';
    modal.innerHTML =
      '<div class="admin-modal-content" style="max-width:620px;">' +
        '<h3>Revision history</h3>' +
        '<p class="dim" style="font-size:12px;">Last 5 versions of this post. Restore replaces editor content — you still need to save.</p>' +
        '<div id="history-list" class="history-list"></div>' +
        '<div class="admin-modal-actions">' +
          '<button class="admin-btn" id="history-close-btn">close</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('#history-close-btn').addEventListener('click', function () {
      modal.classList.add('hidden');
    });

    btn.addEventListener('click', function () {
      var titleInput = document.getElementById('editor-title');
      // Find the current post id via a hidden field / data attr set by blog-engine.
      // Fallback: match by title.
      var posts = BensecDB.getPosts() || [];
      var current = null;
      var editorId = document.getElementById('post-editor') && document.getElementById('post-editor').dataset.editingId;
      if (editorId) current = posts.find(function (p) { return p.id === editorId; });
      if (!current && titleInput) current = posts.find(function (p) { return p.title === titleInput.value; });

      var list = modal.querySelector('#history-list');
      if (!current || !current.revisions || !current.revisions.length) {
        list.innerHTML = '<p class="dim">No revisions yet. History starts once you save edits.</p>';
      } else {
        list.innerHTML = current.revisions.map(function (r, i) {
          var d = new Date(r.ts || Date.now());
          return '<div class="history-item">' +
            '<div class="history-meta">' +
              '<strong>' + escapeHtml(r.title || '(untitled)') + '</strong>' +
              '<span class="dim"> · ' + d.toLocaleString() + '</span>' +
            '</div>' +
            '<div class="history-actions">' +
              '<button class="admin-btn" data-restore="' + i + '">restore</button>' +
            '</div>' +
          '</div>';
        }).join('');
        list.querySelectorAll('[data-restore]').forEach(function (b) {
          b.addEventListener('click', function () {
            var i = parseInt(b.dataset.restore, 10);
            var r = current.revisions[i];
            if (!r) return;
            var titleEl = document.getElementById('editor-title');
            var bodyEl = document.getElementById('editor-body');
            if (titleEl) titleEl.value = r.title || '';
            if (bodyEl) bodyEl.value = r.body || '';
            modal.classList.add('hidden');
            alert('Restored. Click save/publish to keep this version.');
          });
        });
      }
      modal.classList.remove('hidden');
    });
  }

  // ── feat: analytics tab ──
  function initAnalyticsTab() {
    var tabs = document.querySelector('.admin-tabs');
    var dashboard = document.querySelector('.admin-dashboard');
    if (!tabs || !dashboard || document.getElementById('tab-analytics')) return;

    var tabBtn = document.createElement('button');
    tabBtn.className = 'admin-tab-btn';
    tabBtn.id = 'tab-analytics';
    tabBtn.type = 'button';
    tabBtn.textContent = '📊 Analytics';
    tabs.appendChild(tabBtn);

    var panel = document.createElement('div');
    panel.id = 'analytics-panel';
    panel.className = 'hidden';
    panel.innerHTML =
      '<div class="admin-toolbar">' +
        '<button class="admin-btn" id="refresh-analytics-btn">↻ refresh</button>' +
        '<p class="dim" style="font-size:12px; margin:0;">Views tracked anonymously on post reads.</p>' +
      '</div>' +
      '<div id="analytics-content"><p class="dim">Loading…</p></div>';
    // Append after cheatsheets panel
    var cs = document.getElementById('cheatsheets-panel');
    if (cs && cs.parentNode) cs.parentNode.insertBefore(panel, cs.nextSibling);
    else dashboard.appendChild(panel);

    tabBtn.addEventListener('click', function () {
      // Hide all panels + deactivate all tabs (replicate existing behavior)
      document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
      tabBtn.classList.add('active');
      ['posts-panel', 'projects-panel', 'cheatsheets-panel', 'analytics-panel'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', id !== 'analytics-panel');
      });
      // Also hide the editor if open
      var ed = document.getElementById('post-editor');
      if (ed) ed.classList.add('hidden');
      renderAnalytics();
    });

    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'refresh-analytics-btn') renderAnalytics();
    });
  }

  function renderAnalytics() {
    var content = document.getElementById('analytics-content');
    if (!content) return;
    content.innerHTML = '<p class="dim">Loading analytics…</p>';

    if (!window.firebase || !firebase.apps || !firebase.apps.length) {
      content.innerHTML = '<p class="dim">Firebase not ready.</p>'; return;
    }

    var posts = BensecDB.getPosts() || [];
    var totalWords = 0;
    var tagCounts = {};
    posts.forEach(function (p) {
      if ((p.body || '').trim()) totalWords += (p.body || '').trim().split(/\s+/).length;
      (p.tags || []).forEach(function (t) { tagCounts[t] = (tagCounts[t] || 0) + 1; });
    });

    firebase.firestore().collection('analytics').get().then(function (snap) {
      var viewsById = {};
      var totalViews = 0;
      snap.docs.forEach(function (d) {
        var v = (d.data() || {}).views || 0;
        viewsById[d.id] = v;
        totalViews += v;
      });

      var rows = posts.map(function (p) {
        return { id: p.id, title: p.title || '(untitled)', views: viewsById[p.id] || 0, status: p.status };
      }).sort(function (a, b) { return b.views - a.views; });

      var topTags = Object.keys(tagCounts)
        .map(function (t) { return { tag: t, n: tagCounts[t] }; })
        .sort(function (a, b) { return b.n - a.n; })
        .slice(0, 10);

      content.innerHTML =
        '<div class="analytics-stats">' +
          stat('total views', totalViews) +
          stat('total posts', posts.length) +
          stat('total words', totalWords.toLocaleString()) +
          stat('unique tags', Object.keys(tagCounts).length) +
        '</div>' +
        '<h4 class="analytics-h">top posts by views</h4>' +
        '<div class="analytics-table">' +
          rows.map(function (r) {
            return '<div class="analytics-row">' +
              '<span class="a-title">' + escapeHtml(r.title) + '</span>' +
              '<span class="a-status ' + (r.status === 'draft' ? 'is-draft' : '') + '">' + escapeHtml(r.status || 'published') + '</span>' +
              '<span class="a-views">' + r.views + ' views</span>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<h4 class="analytics-h">top tags</h4>' +
        '<div class="analytics-tags">' +
          topTags.map(function (t) {
            return '<span class="a-tag">' + escapeHtml(t.tag) + ' <b>' + t.n + '</b></span>';
          }).join('') +
        '</div>';
    }).catch(function (e) {
      content.innerHTML = '<p class="dim">Could not load views: ' + escapeHtml(String(e && e.message || e)) + '</p>';
    });
  }

  function stat(label, value) {
    return '<div class="analytics-stat"><span class="a-n">' + value + '</span><span class="a-l">' + escapeHtml(label) + '</span></div>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Run once dashboard appears
  function init() {
    // Wait for auth + dashboard visible
    var dash = document.getElementById('admin-dashboard');
    if (!dash || dash.classList.contains('hidden')) return;
    initBulkActions();
    initRevisionsModal();
    initAnalyticsTab();
  }

  var dashObserver = new MutationObserver(function () { init(); });
  var dash = document.getElementById('admin-dashboard');
  if (dash) dashObserver.observe(dash, { attributes: true, attributeFilter: ['class'] });
  // Also run when the editor opens (for revision button)
  var editorObserver = new MutationObserver(function () { initRevisionsModal(); });
  var ed = document.getElementById('post-editor');
  if (ed) editorObserver.observe(ed, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('DOMContentLoaded', init);
  setTimeout(init, 500);
  setTimeout(init, 1500);
}());
