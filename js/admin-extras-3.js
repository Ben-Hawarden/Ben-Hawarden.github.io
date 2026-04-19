// ── Admin extras 3 ──
// feat: confirm-password, bulk actions, version history, post scheduling,
// drag-to-reorder, duplicate post, analytics tab
(function () {
  'use strict';

  if (!/admin\.html/i.test(location.pathname) && !document.getElementById('admin-dashboard')) return;

  // ─────────────────────────────────────────────
  // feat: confirm-password on change
  // ─────────────────────────────────────────────
  function initConfirmPassword() {
    var form = document.getElementById('change-pw-form');
    if (!form || form.__confirmInit) return;
    form.__confirmInit = true;

    if (!document.getElementById('confirm-password')) {
      var grp = document.createElement('div');
      grp.className = 'admin-field';
      grp.style.cssText = 'max-width:380px;margin-top:0.5rem;';
      grp.innerHTML = '<label>confirm:</label><input type="password" id="confirm-password" placeholder="confirm new password">';
      var firstField = form.querySelector('.admin-field');
      if (firstField) firstField.after(grp);
    }

    var saveBtn = document.getElementById('save-pw-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function (e) {
        var np = document.getElementById('new-password');
        var cp = document.getElementById('confirm-password');
        if (!np || !cp) return;
        if (np.value !== cp.value) {
          e.stopImmediatePropagation();
          cp.style.borderColor = '#ff6b6b';
          var err = form.querySelector('.pw-confirm-err');
          if (!err) {
            err = document.createElement('p');
            err.className = 'pw-confirm-err admin-error';
            err.style.cssText = 'color:#ff6b6b;font-size:12px;margin-top:4px;';
            err.textContent = 'passwords do not match';
            form.appendChild(err);
          }
        }
      }, true);
      document.getElementById('cancel-pw-btn') && document.getElementById('cancel-pw-btn').addEventListener('click', function () {
        var cp = document.getElementById('confirm-password');
        if (cp) { cp.value = ''; cp.style.borderColor = ''; }
        var err = form.querySelector('.pw-confirm-err');
        if (err) err.remove();
      });
    }
  }

  // ─────────────────────────────────────────────
  // feat: bulk actions
  // ─────────────────────────────────────────────
  var selectedIds = [];

  function initBulkActions() {
    var list = document.getElementById('posts-list');
    if (!list || list.__bulkInit) return;
    list.__bulkInit = true;

    // Inject bulk bar above the list (hidden until something is checked)
    var bar = document.getElementById('bulk-action-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bulk-action-bar';
      bar.className = 'bulk-bar hidden';
      bar.innerHTML =
        '<span class="bulk-count" id="bulk-count">0 selected</span>' +
        '<button class="admin-btn success" id="bulk-publish">publish</button>' +
        '<button class="admin-btn" id="bulk-unpublish">unpublish</button>' +
        '<button class="admin-btn danger" id="bulk-delete">delete</button>' +
        '<button class="admin-btn" id="bulk-clear">clear</button>';
      list.parentNode.insertBefore(bar, list);
    }

    document.getElementById('bulk-publish').addEventListener('click', function () { bulkSetStatus('published'); });
    document.getElementById('bulk-unpublish').addEventListener('click', function () { bulkSetStatus('draft'); });
    document.getElementById('bulk-delete').addEventListener('click', function () {
      if (!selectedIds.length) return;
      if (!confirm('Delete ' + selectedIds.length + ' post(s)?')) return;
      selectedIds.forEach(function (id) { BensecDB.deletePost(id); });
      selectedIds = [];
      setTimeout(function () { location.reload(); }, 300);
    });
    document.getElementById('bulk-clear').addEventListener('click', function () {
      selectedIds = [];
      list.querySelectorAll('.bulk-checkbox').forEach(function (cb) { cb.checked = false; });
      updateBulkBar();
    });

    // Inject checkboxes when rows appear
    var mo = new MutationObserver(injectCheckboxes);
    mo.observe(list, { childList: true });
    injectCheckboxes();
  }

  function injectCheckboxes() {
    var list = document.getElementById('posts-list');
    if (!list) return;
    list.querySelectorAll('.admin-post-row, .admin-post-item').forEach(function (row) {
      if (row.querySelector('.bulk-checkbox')) return;
      var id = row.dataset.id;
      if (!id) return;
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'bulk-checkbox';
      cb.dataset.id = id;
      cb.addEventListener('change', function () {
        if (cb.checked) { if (selectedIds.indexOf(id) === -1) selectedIds.push(id); }
        else { selectedIds = selectedIds.filter(function (x) { return x !== id; }); }
        updateBulkBar();
      });
      row.insertBefore(cb, row.firstChild);
    });
  }

  function updateBulkBar() {
    var bar = document.getElementById('bulk-action-bar');
    var cnt = document.getElementById('bulk-count');
    if (!bar) return;
    bar.classList.toggle('hidden', selectedIds.length === 0);
    if (cnt) cnt.textContent = selectedIds.length + ' selected';
  }

  function bulkSetStatus(status) {
    if (!selectedIds.length) return;
    var posts = BensecDB.getPosts();
    selectedIds.forEach(function (id) {
      var p = posts.find(function (x) { return x.id === id; });
      if (!p) return;
      p.status = status;
      p.__skipUpdated = true;
      BensecDB.savePost(p);
    });
    selectedIds = [];
    setTimeout(function () { location.reload(); }, 300);
  }

  // ─────────────────────────────────────────────
  // feat: version history (last 5 snapshots)
  // ─────────────────────────────────────────────
  function initVersionHistory() {
    var editor = document.getElementById('post-editor');
    var actions = document.querySelector('#post-editor .editor-actions');
    if (!actions || actions.querySelector('#history-btn')) return;

    var btn = document.createElement('button');
    btn.id = 'history-btn';
    btn.className = 'admin-btn';
    btn.type = 'button';
    btn.textContent = '⏱ history';
    btn.title = 'View last 5 saved versions of this post';
    actions.appendChild(btn);

    // Modal
    var modal = document.createElement('div');
    modal.id = 'history-modal';
    modal.className = 'admin-modal hidden';
    modal.innerHTML =
      '<div class="admin-modal-content history-modal-content">' +
        '<h3>Version history</h3>' +
        '<div id="history-list" class="history-list"></div>' +
        '<div class="admin-modal-actions">' +
          '<button class="admin-btn" id="history-close">close</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    document.getElementById('history-close').addEventListener('click', function () {
      modal.classList.add('hidden');
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.classList.add('hidden');
    });

    btn.addEventListener('click', function () {
      var qs = new URLSearchParams(location.search.replace('?', ''));
      var pid = editor && editor.dataset && editor.dataset.editingId;
      // Try to get from current editing post
      if (!pid) return;
      var posts = BensecDB.getPosts() || [];
      var post = posts.find(function (p) { return p.id === pid; });
      var revs = (post && post.revisions) || [];
      var listEl = document.getElementById('history-list');
      if (!revs.length) {
        listEl.innerHTML = '<p class="dim" style="padding:1rem;">No history yet. Save the post to start recording versions.</p>';
      } else {
        listEl.innerHTML = revs.slice().reverse().map(function (r, i) {
          var ts = r.ts ? new Date(r.ts).toLocaleString() : '—';
          var wc = r.body ? r.body.trim().split(/\s+/).length : 0;
          return '<div class="history-item">' +
            '<div class="history-item-meta"><span class="history-ts">' + ts + '</span><span class="history-wc">' + wc + ' words</span></div>' +
            '<div class="history-title">' + escapeHtml(r.title || '(untitled)') + '</div>' +
            '<button class="admin-btn" data-idx="' + (revs.length - 1 - i) + '" data-restore="1">restore</button>' +
          '</div>';
        }).join('');
        listEl.querySelectorAll('[data-restore]').forEach(function (b) {
          b.addEventListener('click', function () {
            var rev = revs[parseInt(b.dataset.idx, 10)];
            if (!rev) return;
            var titleEl = document.getElementById('editor-title');
            var bodyEl = document.getElementById('editor-body');
            if (titleEl) titleEl.value = rev.title || '';
            if (bodyEl) bodyEl.value = rev.body || '';
            bodyEl && bodyEl.dispatchEvent(new Event('input', { bubbles: true }));
            modal.classList.add('hidden');
          });
        });
      }
      modal.classList.remove('hidden');
    });
  }

  // Hook into savePost to record revisions
  function hookSaveForRevisions() {
    var saveBtns = ['save-post-btn', 'save-draft-btn'];
    saveBtns.forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn || btn.__revHook) return;
      btn.__revHook = true;
      btn.addEventListener('click', function () {
        setTimeout(function () {
          var pid = document.getElementById('post-editor') && document.getElementById('post-editor').dataset.editingId;
          if (!pid) return;
          var posts = BensecDB.getPosts() || [];
          var post = posts.find(function (p) { return p.id === pid; });
          if (!post) return;
          var revs = post.revisions || [];
          revs.push({ ts: Date.now(), title: post.title || '', body: post.body || '' });
          if (revs.length > 5) revs = revs.slice(-5);
          post.revisions = revs;
          BensecDB.savePost(post);
        }, 500);
      });
    });
  }

  // ─────────────────────────────────────────────
  // feat: post scheduling (future publish date)
  // ─────────────────────────────────────────────
  function initScheduling() {
    var statusSel = document.getElementById('editor-status');
    var dateEl = document.getElementById('editor-date');
    if (!statusSel || statusSel.__schedInit) return;
    statusSel.__schedInit = true;

    if (!statusSel.querySelector('option[value="scheduled"]')) {
      var opt = document.createElement('option');
      opt.value = 'scheduled';
      opt.textContent = 'Scheduled';
      statusSel.appendChild(opt);
    }

    // Show a "publish on" hint if scheduled
    statusSel.addEventListener('change', function () {
      var hint = document.getElementById('schedule-hint');
      if (statusSel.value === 'scheduled') {
        if (!hint) {
          hint = document.createElement('p');
          hint.id = 'schedule-hint';
          hint.className = 'editor-help';
          hint.style.color = 'var(--green)';
          hint.textContent = '📅 Will auto-publish on the date set above.';
          statusSel.parentNode.appendChild(hint);
        }
      } else if (hint) hint.remove();
    });

    // On blog-engine load, check scheduled posts and auto-publish if date has passed
    setTimeout(function () {
      if (!window.BensecDB || !BensecDB.getPosts) return;
      var today = new Date().toISOString().slice(0, 10);
      var posts = BensecDB.getPosts();
      var changed = false;
      posts.forEach(function (p) {
        if (p.status === 'scheduled' && p.date && p.date <= today) {
          p.status = 'published';
          p.__skipUpdated = true;
          BensecDB.savePost(p);
          changed = true;
        }
      });
    }, 1000);
  }

  // ─────────────────────────────────────────────
  // feat: drag-to-reorder (projects + cheatsheet sections)
  // ─────────────────────────────────────────────
  function makeDraggable(listEl, onReorder) {
    if (!listEl || listEl.__dragInit) return;
    listEl.__dragInit = true;
    var dragging = null;

    function getItems() { return Array.from(listEl.children).filter(function (el) { return !el.classList.contains('bulk-bar'); }); }

    listEl.addEventListener('dragstart', function (e) {
      dragging = e.target.closest('[draggable]');
      if (dragging) {
        dragging.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      }
    });
    listEl.addEventListener('dragend', function () {
      if (dragging) dragging.classList.remove('dragging');
      dragging = null;
      listEl.querySelectorAll('.drag-over').forEach(function (el) { el.classList.remove('drag-over'); });
      onReorder(getItems());
    });
    listEl.addEventListener('dragover', function (e) {
      e.preventDefault();
      var target = e.target.closest('[draggable]');
      if (!target || target === dragging) return;
      listEl.querySelectorAll('.drag-over').forEach(function (el) { el.classList.remove('drag-over'); });
      target.classList.add('drag-over');
      var rect = target.getBoundingClientRect();
      var after = e.clientY > rect.top + rect.height / 2;
      if (after) target.after(dragging); else target.before(dragging);
    });
    getItems().forEach(function (item) { item.setAttribute('draggable', 'true'); });

    var mo = new MutationObserver(function () {
      getItems().forEach(function (item) { if (!item.getAttribute('draggable')) item.setAttribute('draggable', 'true'); });
    });
    mo.observe(listEl, { childList: true });
  }

  function initDragReorder() {
    var projList = document.getElementById('projects-admin-list');
    if (projList) {
      makeDraggable(projList, function (items) {
        var projects = BensecDB.getProjects() || [];
        var ordered = items.map(function (el) {
          return projects.find(function (p) { return p.id === el.dataset.id; });
        }).filter(Boolean);
        BensecDB.saveProjects(ordered);
      });
    }
    var csList = document.getElementById('cs-sections-list');
    if (csList) {
      makeDraggable(csList, function (items) {
        var sections = BensecDB.getCS() || [];
        var ids = items.map(function (el) { return el.dataset.id; });
        var ordered = ids.map(function (id) { return sections.find(function (s) { return s.id === id || s.title === id; }); }).filter(Boolean);
        if (ordered.length) BensecDB.saveCS(ordered);
      });
    }
  }

  // ── feat: duplicate post — disabled, main admin UI has a duplicate button ──
  function initDuplicatePost() { return; // main UI already has duplicate
    var list = document.getElementById('posts-list');
    if (!list || list.__dupInit) return;
    list.__dupInit = true;
    list.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="dup"]');
      if (!btn) return;
      var id = btn.dataset.id;
      var posts = BensecDB.getPosts() || [];
      var post = posts.find(function (p) { return p.id === id; });
      if (!post) return;
      var clone = JSON.parse(JSON.stringify(post));
      clone.id = 'post-' + Date.now();
      clone.title = (clone.title || '') + ' (copy)';
      clone.status = 'draft';
      delete clone.revisions;
      BensecDB.savePost(clone);
      setTimeout(function () { location.reload(); }, 300);
    });
  }

  // Inject dup buttons in post rows
  function injectDupButtons() {
    var list = document.getElementById('posts-list');
    if (!list) return;
    list.querySelectorAll('.admin-post-row, .admin-post-item').forEach(function (row) {
      if (row.querySelector('[data-action="dup"]')) return;
      var id = row.dataset.id; if (!id) return;
      var b = document.createElement('button');
      b.className = 'inline-btn';
      b.dataset.action = 'dup';
      b.dataset.id = id;
      b.title = 'Duplicate post as draft';
      b.textContent = '⧉';
      var ia = row.querySelector('.inline-actions');
      if (ia) ia.insertBefore(b, ia.firstChild);
      else row.appendChild(b);
    });
  }

  // ─────────────────────────────────────────────
  // feat: analytics tab
  // ─────────────────────────────────────────────
  function initAnalyticsTab() {
    var tabs = document.querySelector('.admin-tabs');
    if (!tabs || tabs.querySelector('#tab-analytics')) return;

    var tabBtn = document.createElement('button');
    tabBtn.className = 'admin-tab-btn';
    tabBtn.id = 'tab-analytics';
    tabBtn.textContent = '📊 Analytics';
    tabs.appendChild(tabBtn);

    var panel = document.createElement('div');
    panel.id = 'analytics-panel';
    panel.className = 'hidden';
    panel.innerHTML =
      '<div class="analytics-loading" id="analytics-loading">' +
        '<p class="dim">Loading analytics…</p>' +
      '</div>' +
      '<div id="analytics-content" class="hidden"></div>';
    tabs.parentNode.appendChild(panel);

    tabBtn.addEventListener('click', function () {
      loadAnalytics();
    });

    // Hook existing tab clicks to hide analytics panel
    document.querySelectorAll('.admin-tab-btn:not(#tab-analytics)').forEach(function (b) {
      b.addEventListener('click', function () { panel.classList.add('hidden'); tabBtn.classList.remove('active'); });
    });
  }

  function loadAnalytics() {
    var panel = document.getElementById('analytics-panel');
    var loading = document.getElementById('analytics-loading');
    var content = document.getElementById('analytics-content');
    var tabs = document.querySelector('.admin-tabs');
    if (!panel) return;

    // Switch tab active state
    document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
    document.getElementById('tab-analytics').classList.add('active');

    // Hide other panels
    ['posts-panel','projects-panel','cheatsheets-panel'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.classList.add('hidden');
    });
    // Hide post editor too
    var ed = document.getElementById('post-editor'); if (ed) ed.classList.add('hidden');

    panel.classList.remove('hidden');
    if (loading) loading.classList.remove('hidden');
    if (content) content.classList.add('hidden');

    if (!window.firebase || !firebase.apps || !firebase.apps.length) {
      if (loading) loading.innerHTML = '<p class="dim">Firebase not ready.</p>';
      return;
    }

    firebase.firestore().collection('analytics').get().then(function (snap) {
      var rows = [];
      snap.docs.forEach(function (d) {
        var data = d.data() || {};
        rows.push({ id: d.id, title: data.title || d.id, views: data.views || 0, lastView: data.lastView });
      });
      rows.sort(function (a, b) { return b.views - a.views; });

      var posts = (window.BensecDB && BensecDB.getPosts) ? BensecDB.getPosts() : [];
      var totalWords = posts.reduce(function (acc, p) {
        return acc + ((p.body || '').trim() ? (p.body || '').trim().split(/\s+/).length : 0);
      }, 0);
      var totalViews = rows.reduce(function (acc, r) { return acc + r.views; }, 0);

      // Tag frequency
      var tagCount = {};
      posts.forEach(function (p) {
        (p.tags || []).forEach(function (t) { tagCount[t] = (tagCount[t] || 0) + 1; });
      });
      var topTags = Object.keys(tagCount).sort(function (a, b) { return tagCount[b] - tagCount[a]; }).slice(0, 10);

      var html =
        '<div class="analytics-stats">' +
          '<div class="analytics-stat"><span class="analytics-n">' + totalViews + '</span><span class="analytics-label">total views</span></div>' +
          '<div class="analytics-stat"><span class="analytics-n">' + posts.filter(function (p) { return p.status !== 'draft'; }).length + '</span><span class="analytics-label">published posts</span></div>' +
          '<div class="analytics-stat"><span class="analytics-n">' + totalWords.toLocaleString() + '</span><span class="analytics-label">total words</span></div>' +
          '<div class="analytics-stat"><span class="analytics-n">' + Object.keys(tagCount).length + '</span><span class="analytics-label">unique tags</span></div>' +
        '</div>' +
        '<h4 class="analytics-section-title">// top posts by views</h4>' +
        '<div class="analytics-posts-list">' +
          (rows.length ? rows.map(function (r, i) {
            var bar = Math.round((r.views / (rows[0].views || 1)) * 100);
            return '<div class="analytics-post-row">' +
              '<span class="analytics-rank">' + (i + 1) + '</span>' +
              '<span class="analytics-post-title">' + escapeHtml(r.title) + '</span>' +
              '<div class="analytics-bar-wrap"><div class="analytics-bar" style="width:' + bar + '%"></div></div>' +
              '<span class="analytics-views">' + r.views + '</span>' +
            '</div>';
          }).join('') : '<p class="dim">No view data yet. Views are recorded when readers open posts.</p>') +
        '</div>' +
        '<h4 class="analytics-section-title">// top tags</h4>' +
        '<div class="analytics-tag-cloud">' +
          topTags.map(function (t) {
            return '<span class="analytics-tag-chip">#' + escapeHtml(t) + ' <span class="analytics-tag-n">' + tagCount[t] + '</span></span>';
          }).join('') +
        '</div>';

      if (loading) loading.classList.add('hidden');
      if (content) { content.innerHTML = html; content.classList.remove('hidden'); }
    }).catch(function (err) {
      if (loading) loading.innerHTML = '<p class="dim">Failed to load: ' + err.message + '</p>';
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ─────────────────────────────────────────────
  // Init wiring
  // ─────────────────────────────────────────────
  function initAll() {
    var dash = document.getElementById('admin-dashboard');
    if (!dash || dash.classList.contains('hidden')) return;
    initAnalyticsTab();
    initBulkActions();
    initDuplicatePost();
    injectDupButtons();
    initDragReorder();
    hookSaveForRevisions();
    initVersionHistory();
    initScheduling();
    initConfirmPassword();
  }

  var dashObs = new MutationObserver(initAll);
  var dash = document.getElementById('admin-dashboard');
  if (dash) dashObs.observe(dash, { attributes: true, attributeFilter: ['class'] });

  var listObs = new MutationObserver(function () { injectDupButtons(); injectCheckboxes(); });
  var postList = document.getElementById('posts-list');
  if (postList) listObs.observe(postList, { childList: true });

  document.addEventListener('DOMContentLoaded', function () { setTimeout(initAll, 500); setTimeout(initAll, 1500); });
}());
