// ── Admin extras 5 ──
// feat: template presets, keyboard shortcut modal (?), activity log,
// post linting warnings, quick stats on post rows, diff highlighting
(function () {
  'use strict';

  if (!/admin\.html/i.test(location.pathname)) return;

  // ── Activity log ──
  var activityLog = [];
  function logActivity(action) {
    var t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    activityLog.unshift({ time: t, action: action });
    if (activityLog.length > 40) activityLog.pop();
    renderActivityLog();
  }
  function renderActivityLog() {
    var el = document.getElementById('admin-activity-log');
    if (!el) return;
    el.innerHTML = activityLog.length === 0
      ? '<span style="color:var(--text-dim)">// no actions yet</span>'
      : activityLog.map(function (e) {
          return '<div class="activity-entry"><span class="ae-time">' + e.time + '</span><span class="ae-action">' + e.action + '</span></div>';
        }).join('');
  }
  function injectActivityLog() {
    var sidebar = document.querySelector('.admin-sidebar, .admin-panel, #admin-sidebar');
    if (!sidebar || sidebar.querySelector('#admin-activity-log')) return;
    var title = document.createElement('p');
    title.className = 'activity-log-title';
    title.textContent = '// session log';
    var log = document.createElement('div');
    log.className = 'admin-activity-log';
    log.id = 'admin-activity-log';
    sidebar.appendChild(title);
    sidebar.appendChild(log);
    renderActivityLog();
  }

  // Patch save / publish / delete actions (best-effort hook)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button, [data-action]');
    if (!btn) return;
    var text = (btn.textContent || '').trim().toLowerCase();
    var action = btn.dataset.action || '';
    if (action === 'publish' || text.includes('publish')) logActivity('Published post');
    else if (action === 'save' || text.includes('save')) logActivity('Saved draft');
    else if (action === 'delete' || text.includes('delete')) logActivity('Deleted post');
    else if (action === 'duplicate' || text.includes('duplic')) logActivity('Duplicated post');
    else if (text.includes('restore')) logActivity('Restored revision');
    else if (text.includes('scheduled')) logActivity('Scheduled post');
  }, true);

  // ── Post linting ──
  function lintPost() {
    var titleEl = document.getElementById('post-title-input') || document.querySelector('input[name="title"], #title');
    var bodyEl  = document.getElementById('post-body-input')  || document.querySelector('textarea[name="body"], #body');
    var tagsEl  = document.getElementById('post-tags-input')  || document.querySelector('input[name="tags"], #tags');
    if (!titleEl || !bodyEl) return [];

    var title  = (titleEl.value || '').trim();
    var body   = (bodyEl.value || '').trim();
    var words  = body ? body.split(/\s+/).length : 0;
    var warns  = [];

    if (!title)          warns.push({ level: 'error',   msg: 'Title is empty.' });
    else if (title.length > 80) warns.push({ level: 'warning', msg: 'Title is long (' + title.length + ' chars). Consider shortening.' });

    if (!body)           warns.push({ level: 'error',   msg: 'Body is empty.' });
    else if (words < 50) warns.push({ level: 'warning', msg: 'Very short post (' + words + ' words).' });

    if (tagsEl && !(tagsEl.value || '').trim()) warns.push({ level: 'info', msg: 'No tags set.' });

    var hasH1 = /^#\s+\S/m.test(body);
    if (hasH1) warns.push({ level: 'warning', msg: 'Body contains an H1 (#). Use H2+ for headings inside posts.' });

    var hasAbsImg = /!\[.*?\]\(https?:\/\//i.test(body);
    if (hasAbsImg) warns.push({ level: 'info', msg: 'Post contains absolute image URLs — check they\'re accessible.' });

    if (body.split('\n').some(function (l) { return l.length > 1000; }))
      warns.push({ level: 'warning', msg: 'Very long line detected — may affect readability.' });

    return warns;
  }

  function renderLint() {
    var container = document.getElementById('lint-warnings-container');
    if (!container) return;
    var warns = lintPost();
    if (!warns.length) { container.innerHTML = ''; return; }
    container.innerHTML =
      '<div class="lint-warnings">' +
        warns.map(function (w) {
          var icon = w.level === 'error' ? '✖' : w.level === 'warning' ? '⚠' : 'ℹ';
          return '<div class="lint-warn ' + w.level + '">' + icon + ' ' + w.msg + '</div>';
        }).join('') +
      '</div>';
  }

  function injectLintContainer() {
    var publishBtn = document.querySelector('[data-action="publish"], button.publish-btn');
    if (!publishBtn || document.getElementById('lint-warnings-container')) return;
    var container = document.createElement('div');
    container.id = 'lint-warnings-container';
    publishBtn.closest('div, section, form') ?
      publishBtn.parentNode.insertBefore(container, publishBtn) :
      publishBtn.insertAdjacentElement('beforebegin', container);
  }

  // Run lint on input and before publish
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.matches('input[name="title"], #title, textarea[name="body"], #body, #post-title-input, #post-body-input')) {
      renderLint();
    }
  });
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var text = (btn.textContent || '').trim().toLowerCase();
    if (text.includes('publish') || btn.dataset.action === 'publish') {
      renderLint();
      logActivity('Lint checked before publish');
    }
  }, true);

  // ── Template presets ──
  var PRESETS_KEY = 'bensec-admin-presets';
  var DEFAULT_PRESETS = [
    {
      name: 'CTF — HTB/THM',
      body: [
        '## Overview',
        '',
        '| | |',
        '|---|---|',
        '| **Platform** | HackTheBox / TryHackMe |',
        '| **Difficulty** | Easy / Medium / Hard |',
        '| **OS** | Linux / Windows |',
        '| **Tags** | `web`, `privesc`, `enumeration` |',
        '',
        'Brief description of the machine and what makes it interesting.',
        '',
        '## Enumeration',
        '',
        '### Nmap Scan',
        '',
        '```bash',
        'nmap -sC -sV -p- --min-rate 5000 -oN nmap.txt $IP',
        '```',
        '',
        '```',
        '# paste key results here',
        '```',
        '',
        '### Web Recon',
        '',
        'Visiting `http://$IP` shows...',
        '',
        '```bash',
        'gobuster dir -u http://$IP -w /usr/share/wordlists/dirb/common.txt',
        '```',
        '',
        '## Foothold',
        '',
        'Describe how you got initial access.',
        '',
        '```bash',
        '# exploit command',
        '```',
        '',
        '## Exploitation',
        '',
        'Walk through the vulnerability and how it was leveraged.',
        '',
        '## Privesc',
        '',
        '```bash',
        'sudo -l',
        '# or',
        'find / -perm -4000 2>/dev/null',
        '```',
        '',
        'Describe the privilege escalation path.',
        '',
        '## Flags',
        '',
        '```',
        'user.txt: ',
        'root.txt: ',
        '```',
        '',
        '## Key Takeaways',
        '',
        '- ',
        '- ',
        '- ',
      ].join('\n')
    },
    {
      name: 'CTF — Challenge',
      body: [
        '## Challenge Info',
        '',
        '| | |',
        '|---|---|',
        '| **CTF** | CTF Name |',
        '| **Category** | Web / Pwn / Rev / Crypto / Misc |',
        '| **Points** | 100 |',
        '| **Difficulty** | Easy |',
        '',
        '## Description',
        '',
        '>',
        '',
        '## Solution',
        '',
        'Walk through the thought process and steps taken.',
        '',
        '```bash',
        '# key commands',
        '```',
        '',
        '## Flag',
        '',
        '```',
        'flag{...}',
        '```',
        '',
        '## Key Takeaways',
        '',
        '- ',
        '- ',
      ].join('\n')
    },
    {
      name: 'Blog Note',
      body: '## Background\n\n## Key Takeaways\n\n- \n- \n- \n\n## References\n\n- '
    },
    {
      name: 'Tool Review',
      body: '## What is it?\n\n## Installation\n\n```bash\n\n```\n\n## Usage\n\n## Verdict\n'
    }
  ];

  function loadPresets() {
    try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || 'null') || DEFAULT_PRESETS; } catch (e) { return DEFAULT_PRESETS; }
  }
  function savePresets(presets) {
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); } catch (e) {}
  }

  function applyPreset(preset) {
    var bodyEl = document.getElementById('post-body-input') || document.querySelector('textarea[name="body"], #body');
    if (!bodyEl) return;
    if ((bodyEl.value || '').trim() && !confirm('Replace editor content with "' + preset.name + '" template?')) return;
    bodyEl.value = preset.body;
    bodyEl.dispatchEvent(new Event('input', { bubbles: true }));
    logActivity('Loaded template: ' + preset.name);
  }

  function injectPresetBar() {
    var bodyEl = document.getElementById('post-body-input') || document.querySelector('textarea[name="body"], #body');
    if (!bodyEl || bodyEl.parentNode.querySelector('.template-presets-bar')) return;
    var presets = loadPresets();
    var bar = document.createElement('div');
    bar.className = 'template-presets-bar';

    presets.forEach(function (p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'template-preset-btn';
      btn.textContent = p.name;
      btn.addEventListener('click', function () { applyPreset(p); });
      bar.appendChild(btn);
    });

    // "Save as preset" button
    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'template-save-btn';
    saveBtn.textContent = '+ save as preset';
    saveBtn.addEventListener('click', function () {
      var name = prompt('Preset name:');
      if (!name) return;
      var current = loadPresets();
      current.push({ name: name, body: bodyEl.value || '' });
      savePresets(current);
      logActivity('Saved preset: ' + name);
      // Refresh bar
      var existing = bodyEl.parentNode.querySelector('.template-presets-bar');
      if (existing) existing.remove();
      injectPresetBar();
    });
    bar.appendChild(saveBtn);

    bodyEl.parentNode.insertBefore(bar, bodyEl);
  }

  // ── Quick stats on post rows ──
  function injectPostRowStats() {
    var rows = document.querySelectorAll('.post-row, .admin-post-item, [data-post-id]');
    rows.forEach(function (row) {
      if (row.querySelector('.post-row-stats')) return;
      var titleEl = row.querySelector('.post-row-title, h3, h4, strong');
      var dateEl  = row.querySelector('.post-row-date, [data-date], time');
      var bodyText = row.dataset.body || '';

      // Try to get from inline data
      var words = bodyText ? bodyText.split(/\s+/).length : null;
      var dateStr = row.dataset.date || (dateEl ? dateEl.textContent : '');

      if (!words && !dateStr) return;

      var stats = document.createElement('div');
      stats.className = 'post-row-stats';
      if (words)   stats.innerHTML += '<span>📄 ~' + words + ' words</span>';
      if (dateStr) stats.innerHTML += '<span>📅 ' + dateStr + '</span>';

      if (titleEl) titleEl.insertAdjacentElement('afterend', stats);
      else row.appendChild(stats);
    });
  }

  // ── Keyboard shortcut modal (?) ──
  function injectKbdModal() {
    if (document.getElementById('kbd-modal-overlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'kbd-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Keyboard shortcuts');
    overlay.innerHTML =
      '<div id="kbd-modal">' +
        '<button class="kbd-close" id="kbd-modal-close" aria-label="Close">✕</button>' +
        '<h2>// keyboard shortcuts</h2>' +

        '<p class="kbd-section-title">Navigation</p>' +
        '<div class="kbd-row"><span>Command palette</span><div><kbd>Ctrl</kbd><kbd>K</kbd></div></div>' +
        '<div class="kbd-row"><span>In-post search</span><div><kbd>Ctrl</kbd><kbd>F</kbd></div></div>' +
        '<div class="kbd-row"><span>Focus blog search</span><div><kbd>/</kbd></div></div>' +
        '<div class="kbd-row"><span>Show this modal</span><div><kbd>?</kbd></div></div>' +
        '<div class="kbd-row"><span>Close modal / overlay</span><div><kbd>Esc</kbd></div></div>' +

        '<p class="kbd-section-title">Admin editor</p>' +
        '<div class="kbd-row"><span>Bold</span><div><kbd>Ctrl</kbd><kbd>B</kbd></div></div>' +
        '<div class="kbd-row"><span>Italic</span><div><kbd>Ctrl</kbd><kbd>I</kbd></div></div>' +
        '<div class="kbd-row"><span>Inline code</span><div><kbd>Ctrl</kbd><kbd>`</kbd></div></div>' +
        '<div class="kbd-row"><span>Save draft</span><div><kbd>Ctrl</kbd><kbd>S</kbd></div></div>' +

        '<p class="kbd-section-title">Blog</p>' +
        '<div class="kbd-row"><span>Next post (arrow nav)</span><div><kbd>→</kbd></div></div>' +
        '<div class="kbd-row"><span>Prev post</span><div><kbd>←</kbd></div></div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('kbd-modal-close').addEventListener('click', closeKbd);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeKbd(); });
  }

  function openKbd()  {
    var o = document.getElementById('kbd-modal-overlay');
    if (o) { o.classList.add('open'); document.body.style.overflow = 'hidden'; }
  }
  function closeKbd() {
    var o = document.getElementById('kbd-modal-overlay');
    if (o) { o.classList.remove('open'); document.body.style.overflow = ''; }
  }

  // ── Init ──
  function run() {
    injectKbdModal();
    injectActivityLog();
    injectPresetBar();
    injectLintContainer();
    injectPostRowStats();
  }

  var observer = new MutationObserver(function () {
    injectActivityLog();
    injectPresetBar();
    injectLintContainer();
    injectPostRowStats();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      run();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    run();
    observer.observe(document.body, { childList: true, subtree: true });
  }
}());

// ── Global keyboard shortcut modal (all pages) ──
(function () {
  'use strict';
  document.addEventListener('keydown', function (e) {
    if (e.key !== '?') return;
    var tag = (document.activeElement || {}).tagName || '';
    if (/input|textarea|select/i.test(tag)) return;
    var overlay = document.getElementById('kbd-modal-overlay');
    if (!overlay) return;
    if (overlay.classList.contains('open')) {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    } else {
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var overlay = document.getElementById('kbd-modal-overlay');
      if (overlay && overlay.classList.contains('open')) {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
      }
    }
  });
}());
