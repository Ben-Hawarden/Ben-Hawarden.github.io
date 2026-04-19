// ── Command palette (Ctrl+K) ──
// feat: fuzzy search across pages, posts, and actions
(function () {
  'use strict';

  var palette = null;
  var input = null;
  var results = null;
  var allItems = [];
  var selectedIdx = 0;
  var isOpen = false;

  // Static navigation items
  var NAV_ITEMS = [
    { type: 'nav', label: 'Home',          desc: 'Go to homepage',        href: 'index.html',       icon: '🏠' },
    { type: 'nav', label: 'Blog',          desc: 'All posts',             href: 'blog.html',        icon: '📝' },
    { type: 'nav', label: 'Archive',       desc: 'Posts by year',         href: 'archive.html',     icon: '📅' },
    { type: 'nav', label: 'Tags',          desc: 'All tags',              href: 'tags.html',        icon: '🏷' },
    { type: 'nav', label: 'Cheatsheets',   desc: 'Command references',    href: 'cheatsheets.html', icon: '📋' },
    { type: 'nav', label: 'Resources',     desc: 'Useful links',          href: 'resources.html',   icon: '🔗' },
    { type: 'nav', label: 'Achievements',  desc: 'Now / achievements',    href: 'now.html',         icon: '🏆' },
    { type: 'nav', label: 'Admin',         desc: 'Admin panel',           href: 'admin.html',       icon: '🔒' },
  ];

  var ACTION_ITEMS = [
    { type: 'action', label: 'Toggle theme',  desc: 'Switch dark/light',  icon: '◑',
      run: function () {
        var root = document.documentElement;
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
      }
    },
    { type: 'action', label: 'Toggle cursor trail', desc: 'Hacker trail effect', icon: '>_',
      run: function () {
        var btn = document.querySelector('.trail-toggle');
        if (btn) btn.click();
      }
    },
    { type: 'action', label: 'Scroll to top', desc: 'Jump to top of page', icon: '↑',
      run: function () { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    },
  ];

  function buildPalette() {
    if (palette) return;
    palette = document.createElement('div');
    palette.id = 'cmd-palette';
    palette.className = 'cmd-palette hidden';
    palette.innerHTML =
      '<div class="cmd-backdrop"></div>' +
      '<div class="cmd-box">' +
        '<div class="cmd-input-row">' +
          '<span class="cmd-prompt">⌘</span>' +
          '<input id="cmd-input" type="text" placeholder="Search pages, posts, actions…" autocomplete="off" spellcheck="false">' +
          '<kbd class="cmd-esc">esc</kbd>' +
        '</div>' +
        '<div id="cmd-results" class="cmd-results"></div>' +
      '</div>';
    document.body.appendChild(palette);

    input = document.getElementById('cmd-input');
    results = document.getElementById('cmd-results');

    palette.querySelector('.cmd-backdrop').addEventListener('click', closePalette);
    input.addEventListener('input', function () { render(input.value.trim()); });
    input.addEventListener('keydown', handleKey);
  }

  function open() {
    if (!palette) buildPalette();
    loadPosts();
    palette.classList.remove('hidden');
    isOpen = true;
    input.value = '';
    render('');
    setTimeout(function () { input.focus(); input.select(); }, 10);
  }

  function closePalette() {
    if (!palette) return;
    palette.classList.add('hidden');
    isOpen = false;
  }

  function loadPosts() {
    var posts = (window.BensecDB && BensecDB.getPosts) ? BensecDB.getPosts() : [];
    allItems = NAV_ITEMS.concat(
      posts.filter(function (p) { return p.status !== 'draft'; }).map(function (p) {
        return {
          type: 'post',
          label: p.title || '(untitled)',
          desc: (p.tags || []).map(function (t) { return '#' + t; }).join(' '),
          date: p.date || '',
          href: 'post.html?id=' + encodeURIComponent(p.id),
          icon: '📝'
        };
      })
    ).concat(ACTION_ITEMS);
  }

  function score(item, q) {
    if (!q) return 1;
    var label = (item.label || '').toLowerCase();
    var desc  = (item.desc  || '').toLowerCase();
    q = q.toLowerCase();
    if (label.startsWith(q)) return 3;
    if (label.includes(q))   return 2;
    if (desc.includes(q))    return 1;
    // Fuzzy: all chars of q appear in label in order
    var li = 0;
    for (var i = 0; i < q.length; i++) {
      li = label.indexOf(q[i], li);
      if (li === -1) return 0;
      li++;
    }
    return 0.5;
  }

  function highlight(text, q) {
    if (!q) return escH(text);
    var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escH(text).replace(re, '<mark>$1</mark>');
  }

  function render(q) {
    var scored = allItems.map(function (item) { return { item: item, s: score(item, q) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 9);

    if (!scored.length) {
      results.innerHTML = '<div class="cmd-empty">No results for "' + escH(q) + '"</div>';
      return;
    }

    results.innerHTML = scored.map(function (x, i) {
      var item = x.item;
      var tag = item.href ? 'a' : 'button';
      var attrs = item.href ? 'href="' + item.href + '"' : 'type="button"';
      return '<' + tag + ' class="cmd-item' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '" ' + attrs + '>' +
        '<span class="cmd-item-icon">' + (item.icon || '▸') + '</span>' +
        '<span class="cmd-item-body">' +
          '<span class="cmd-item-label">' + highlight(item.label, q) + '</span>' +
          (item.desc ? '<span class="cmd-item-desc">' + escH(item.desc) + '</span>' : '') +
        '</span>' +
        (item.type === 'action' ? '<span class="cmd-item-type">action</span>' : '') +
      '</' + tag + '>';
    }).join('');
    selectedIdx = 0;

    results.querySelectorAll('.cmd-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var idx = parseInt(el.dataset.idx, 10);
        var item = scored[idx] && scored[idx].item;
        if (!item) return;
        if (item.run) { closePalette(); item.run(); }
        else closePalette();
      });
      el.addEventListener('mouseenter', function () {
        results.querySelectorAll('.cmd-item').forEach(function (e) { e.classList.remove('active'); });
        el.classList.add('active');
        selectedIdx = parseInt(el.dataset.idx, 10);
      });
    });
  }

  function handleKey(e) {
    var items = results ? results.querySelectorAll('.cmd-item') : [];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx = (selectedIdx + 1) % items.length;
      items.forEach(function (el, i) { el.classList.toggle('active', i === selectedIdx); });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx = (selectedIdx - 1 + items.length) % items.length;
      items.forEach(function (el, i) { el.classList.toggle('active', i === selectedIdx); });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var active = results && results.querySelector('.cmd-item.active');
      if (active) active.click();
    } else if (e.key === 'Escape') {
      closePalette();
    }
  }

  document.addEventListener('keydown', function (e) {
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      if (/textarea/i.test(tag)) return;
      e.preventDefault();
      if (isOpen) closePalette(); else open();
    }
    if (e.key === 'Escape' && isOpen) closePalette();
  });

  function escH(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  document.addEventListener('DOMContentLoaded', buildPalette);
}());
