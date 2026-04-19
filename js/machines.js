// ── machines.js ──
// HTB / TryHackMe machine tracker backed by Firestore machines/ collection
(function () {
  'use strict';

  if (!/machines\.html/i.test(location.pathname)) return;

  var ADMIN_UID = 'b4t5IxeGyLSGyozcweUrBV2fbzc2';
  var isAdmin = false;
  var allMachines = [];
  var currentFilter = 'all';

  function escH(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── Load machines from Firestore ──
  function loadMachines() {
    if (!window.firebase || !firebase.apps || !firebase.apps.length) {
      showEmpty('// firebase not loaded');
      return;
    }
    firebase.firestore().collection('machines').orderBy('date', 'desc').get()
      .then(function (snap) {
        allMachines = [];
        snap.forEach(function (doc) {
          var d = doc.data();
          d._id = doc.id;
          allMachines.push(d);
        });
        renderMachines();
        renderStats();
      })
      .catch(function (err) {
        console.error('machines load error', err);
        showEmpty('// could not load machines');
      });
  }

  function showEmpty(msg) {
    var grid = document.getElementById('machines-grid');
    if (grid) grid.innerHTML = '<div class="machines-empty">' + escH(msg) + '</div>';
  }

  // ── Render ──
  function renderMachines() {
    var grid = document.getElementById('machines-grid');
    if (!grid) return;

    var filtered = allMachines.filter(function (m) {
      if (currentFilter === 'all')    return true;
      if (currentFilter === 'htb')    return (m.platform || '').toLowerCase() === 'htb';
      if (currentFilter === 'thm')    return (m.platform || '').toLowerCase() === 'thm';
      if (currentFilter === 'pwned')  return (m.status || '') === 'pwned';
      if (currentFilter === 'easy')   return (m.difficulty || '').toLowerCase() === 'easy';
      if (currentFilter === 'medium') return (m.difficulty || '').toLowerCase() === 'medium';
      if (currentFilter === 'hard')   return (m.difficulty || '').toLowerCase() === 'hard';
      if (currentFilter === 'insane') return (m.difficulty || '').toLowerCase() === 'insane';
      return true;
    });

    if (!filtered.length) { showEmpty('// no machines match this filter'); return; }

    grid.innerHTML = filtered.map(function (m) {
      var diff = (m.difficulty || 'unknown').toLowerCase();
      var plat = (m.platform || '').toLowerCase();
      var stat = (m.status || 'todo').toLowerCase();
      var tags = Array.isArray(m.tags) ? m.tags : (m.tags ? String(m.tags).split(',').map(function (t) { return t.trim(); }) : []);

      var statusLabel = stat === 'pwned' ? '✔ pwned' : stat === 'user' ? '◑ user' : '○ todo';

      var writeupLink = m.writeup
        ? '<a class="mc-writeup-link" href="post.html?id=' + encodeURIComponent(m.writeup) + '">→ writeup</a>'
        : '';

      var deleteBtn = isAdmin
        ? '<button class="mc-delete-btn" data-id="' + escH(m._id) + '" style="font-size:0.65rem;background:none;border:none;color:#ff4444;cursor:pointer;margin-left:8px;" title="Delete">✕</button>'
        : '';

      return '<div class="machine-card reveal visible" data-difficulty="' + diff + '" data-id="' + escH(m._id) + '">' +
        '<div class="mc-header">' +
          '<span class="mc-name">' + escH(m.name || '') + '</span>' +
          '<span class="mc-platform ' + plat + '">' + (plat === 'htb' ? 'HTB' : plat === 'thm' ? 'THM' : escH(m.platform || '')) + '</span>' +
        '</div>' +
        '<div class="mc-meta">' +
          '<span class="mc-diff ' + diff + '">' + diff + '</span>' +
          (m.os ? '<span>🖥 ' + escH(m.os) + '</span>' : '') +
        '</div>' +
        (tags.length ? '<div class="mc-tags">' + tags.map(function (t) { return '<span class="mc-tag">' + escH(t) + '</span>'; }).join('') + '</div>' : '') +
        (m.notes ? '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:8px;">' + escH(m.notes) + '</div>' : '') +
        '<div class="mc-footer">' +
          '<span class="mc-status ' + stat + '">' + statusLabel + '</span>' +
          writeupLink + deleteBtn +
        '</div>' +
      '</div>';
    }).join('');

    // Attach delete handlers
    if (isAdmin) {
      grid.querySelectorAll('.mc-delete-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.dataset.id;
          if (!confirm('Delete machine?')) return;
          firebase.firestore().collection('machines').doc(id).delete().then(loadMachines);
        });
      });
    }

    // Add machine button (admin only)
    if (isAdmin && !document.getElementById('add-machine-fab')) {
      var fab = document.createElement('button');
      fab.id = 'add-machine-fab';
      fab.className = 'add-machine-btn reveal visible';
      fab.style.cssText = 'position:fixed;bottom:28px;right:28px;z-index:500;';
      fab.innerHTML = '+ add machine';
      document.body.appendChild(fab);
      fab.addEventListener('click', openModal);
    }
  }

  function renderStats() {
    var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-total',  allMachines.length);
    set('stat-pwned',  allMachines.filter(function (m) { return m.status === 'pwned'; }).length);
    set('stat-htb',    allMachines.filter(function (m) { return (m.platform || '').toLowerCase() === 'htb'; }).length);
    set('stat-thm',    allMachines.filter(function (m) { return (m.platform || '').toLowerCase() === 'thm'; }).length);
    set('stat-easy',   allMachines.filter(function (m) { return (m.difficulty || '').toLowerCase() === 'easy'; }).length);
    set('stat-medium', allMachines.filter(function (m) { return (m.difficulty || '').toLowerCase() === 'medium'; }).length);
    set('stat-hard',   allMachines.filter(function (m) { return (m.difficulty || '').toLowerCase() === 'hard'; }).length);
  }

  // ── Filters ──
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.machine-filter-btn');
    if (!btn) return;
    document.querySelectorAll('.machine-filter-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentFilter = btn.dataset.filter || 'all';
    renderMachines();
  });

  // ── Add machine modal ──
  function openModal() {
    var overlay = document.getElementById('machine-modal-overlay');
    if (overlay) { overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
  }
  function closeModal() {
    var overlay = document.getElementById('machine-modal-overlay');
    if (overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
  }

  document.getElementById('mc-cancel') && document.getElementById('mc-cancel').addEventListener('click', closeModal);
  var overlay = document.getElementById('machine-modal-overlay');
  if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

  document.addEventListener('DOMContentLoaded', function () {
    var cancelBtn = document.getElementById('mc-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    var saveBtn = document.getElementById('mc-save');
    if (saveBtn) saveBtn.addEventListener('click', saveMachine);
  });

  function saveMachine() {
    var name = (document.getElementById('mc-name') || {}).value || '';
    if (!name.trim()) { alert('Name is required.'); return; }
    var machine = {
      name:       name.trim(),
      platform:   (document.getElementById('mc-platform') || {}).value || 'htb',
      difficulty: (document.getElementById('mc-diff') || {}).value || 'medium',
      os:         (document.getElementById('mc-os') || {}).value || 'linux',
      status:     (document.getElementById('mc-status') || {}).value || 'pwned',
      writeup:    ((document.getElementById('mc-writeup') || {}).value || '').trim(),
      tags:       ((document.getElementById('mc-tags') || {}).value || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean),
      notes:      ((document.getElementById('mc-notes') || {}).value || '').trim(),
      date:       new Date().toISOString()
    };
    firebase.firestore().collection('machines').add(machine).then(function () {
      closeModal();
      loadMachines();
      // Clear form
      ['mc-name','mc-writeup','mc-tags','mc-notes'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
    }).catch(function (err) { alert('Error saving: ' + err.message); });
  }

  // ── Auth check ──
  function checkAdmin() {
    if (!window.firebase || !firebase.auth) return;
    firebase.auth().onAuthStateChanged(function (user) {
      isAdmin = !!(user && user.uid === ADMIN_UID);
      renderMachines();
    });
  }

  // ── Init ──
  document.addEventListener('DOMContentLoaded', function () {
    loadMachines();
    checkAdmin();
  });
}());
