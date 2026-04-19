// ── Fun & polish extras ──
// feat: Konami code Easter egg terminal
// feat: Typewriter hero subtitle
// feat: Status timer on homepage
// feat: Share button on posts
// feat: Last-read dim on blog cards
(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─────────────────────────────────────────────
  // feat: Konami code Easter egg
  // ─────────────────────────────────────────────
  var KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  var konamiPos = 0;

  document.addEventListener('keydown', function (e) {
    if (e.key === KONAMI[konamiPos]) {
      konamiPos++;
      if (konamiPos === KONAMI.length) {
        konamiPos = 0;
        openTerminal();
      }
    } else {
      konamiPos = e.key === KONAMI[0] ? 1 : 0;
    }
  });

  function openTerminal() {
    if (document.getElementById('easter-terminal')) return;
    var term = document.createElement('div');
    term.id = 'easter-terminal';
    term.className = 'easter-term';
    term.innerHTML =
      '<div class="easter-term-bar">' +
        '<span class="easter-term-title">root@bensec:~#</span>' +
        '<button class="easter-term-close" aria-label="Close terminal">✕</button>' +
      '</div>' +
      '<div class="easter-term-body" id="easter-term-body">' +
        '<p class="et-line">Last login: ' + new Date().toUTCString() + ' on pts/0</p>' +
        '<p class="et-line">╔══════════════════════════════════════╗</p>' +
        '<p class="et-line">║   Welcome to bensec shell v1.33.7    ║</p>' +
        '<p class="et-line">╚══════════════════════════════════════╝</p>' +
        '<p class="et-line dim">Type <span class="et-green">help</span> to see available commands.</p>' +
      '</div>' +
      '<div class="easter-term-input-row">' +
        '<span class="easter-term-prompt">root@bensec:~# </span>' +
        '<input type="text" id="easter-term-input" autocomplete="off" spellcheck="false" aria-label="Terminal input">' +
      '</div>';
    document.body.appendChild(term);

    term.querySelector('.easter-term-close').addEventListener('click', function () { term.remove(); });
    term.addEventListener('click', function () { document.getElementById('easter-term-input').focus(); });

    var input = document.getElementById('easter-term-input');
    input.focus();
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var cmd = input.value.trim();
        input.value = '';
        runTermCmd(cmd);
      }
    });
  }

  var FS = {
    '/etc/passwd': 'root:x:0:0:root:/root:/bin/bash\nbensec:x:1337:1337:hacker:/home/bensec:/bin/zsh',
    '/flag.txt':   'HTB{y0u_f0und_th3_k0nam1_34st3r_3gg_gg_wp}',
    '/etc/shadow': 'Permission denied.',
    '/secrets':    'There are no secrets. Only vectors.',
    '/home/bensec/.bash_history': 'nmap -sC -sV 10.10.10.x\ngobuster dir -u http://10.10.10.x -w /usr/share/wordlists/dirb/common.txt\nsudo -l\ncurl -s http://10.10.10.x/flag.txt'
  };

  function runTermCmd(cmd) {
    var body = document.getElementById('easter-term-body');
    if (!body) return;
    function print(txt, cls) {
      var p = document.createElement('p');
      p.className = 'et-line' + (cls ? ' ' + cls : '');
      p.innerHTML = txt;
      body.appendChild(p);
      body.scrollTop = body.scrollHeight;
    }
    print('<span class="et-green">root@bensec:~#</span> ' + escapeHtml(cmd));
    var parts = cmd.trim().split(/\s+/);
    var c = parts[0];
    var arg = parts.slice(1).join(' ');
    if (!c) return;
    switch (c) {
      case 'help':
        print('Available commands: whoami, id, uname, hostname, uptime, ls, cat, pwd, echo, clear, exit, sudo, hack');
        break;
      case 'whoami': print('root'); break;
      case 'id': print('uid=0(root) gid=0(root) groups=0(root),1337(hackers)'); break;
      case 'uname': print('Linux bensec 6.1.0-kali1-amd64 #1 SMP PREEMPT_DYNAMIC Kali 6.1.0 x86_64 GNU/Linux'); break;
      case 'hostname': print('bensec'); break;
      case 'uptime': print('up 1337 days, 13:37:37, 1 user, load average: 0.13, 0.37, 0.73'); break;
      case 'pwd': print(arg || '/root'); break;
      case 'ls':
        if (!arg || arg === '/') print('bin  boot  etc  flag.txt  home  secrets  usr  var');
        else print('flag.txt  .bash_history  loot.txt  nmap-output.txt');
        break;
      case 'cat':
        if (!arg) { print('cat: missing operand', 'et-err'); break; }
        var path = arg.startsWith('/') ? arg : '/' + arg;
        if (FS[path]) print(FS[path].replace(/\n/g, '<br>'));
        else print('cat: ' + escapeHtml(arg) + ': No such file or directory', 'et-err');
        break;
      case 'echo': print(escapeHtml(arg) || ''); break;
      case 'sudo':
        if (arg === '-l') print('(root) NOPASSWD: ALL');
        else print('[sudo] password for bensec: <span class="et-green">*********</span><br>bensec is not in the sudoers file. This incident will be reported.');
        break;
      case 'hack': print('<span class="et-green">HACKING THE PLANET</span>... just kidding. But you did find the Easter egg 🐣'); break;
      case 'clear':
        document.getElementById('easter-term-body').innerHTML = '';
        break;
      case 'exit': document.getElementById('easter-terminal') && document.getElementById('easter-terminal').remove(); break;
      default: print('bash: ' + escapeHtml(c) + ': command not found', 'et-err');
    }
  }

  // ─────────────────────────────────────────────
  // feat: typewriter hero subtitle cycling
  // ─────────────────────────────────────────────
  function initTypewriter() {
    if (reduced) return;
    var el = document.getElementById('hero-typewriter');
    if (!el || el.__twInit) return;
    el.__twInit = true;
    var lines = el.dataset.lines ? el.dataset.lines.split('|') : [el.textContent.trim()];
    var idx = 0, charIdx = 0, deleting = false, pause = 0;

    function tick() {
      if (pause > 0) { pause--; setTimeout(tick, 80); return; }
      var line = lines[idx];
      if (!deleting) {
        el.textContent = line.slice(0, charIdx + 1);
        charIdx++;
        if (charIdx >= line.length) { deleting = true; pause = 30; }
        setTimeout(tick, 75);
      } else {
        el.textContent = line.slice(0, charIdx - 1);
        charIdx--;
        if (charIdx <= 0) { deleting = false; idx = (idx + 1) % lines.length; pause = 8; }
        setTimeout(tick, 40);
      }
    }
    el.textContent = '';
    tick();
  }

  // ─────────────────────────────────────────────
  // feat: status timer ("started X days ago")
  // ─────────────────────────────────────────────
  function initStatusTimer() {
    var el = document.getElementById('hero-status');
    if (!el || el.__timerInit) return;
    el.__timerInit = true;

    var ts = el.dataset.startedAt;
    if (!ts) return;
    var started = new Date(ts);
    if (isNaN(started.getTime())) return;

    var timerEl = document.createElement('span');
    timerEl.className = 'status-timer';
    el.appendChild(timerEl);

    function update() {
      var diff = Date.now() - started.getTime();
      var days = Math.floor(diff / 86400000);
      var hrs = Math.floor((diff % 86400000) / 3600000);
      var mins = Math.floor((diff % 3600000) / 60000);
      timerEl.textContent = ' · ' + (days > 0 ? days + 'd ' : '') + hrs + 'h ' + mins + 'm';
    }
    update();
    setInterval(update, 60000);
  }

  // ─────────────────────────────────────────────
  // feat: share button on posts
  // ─────────────────────────────────────────────
  function initShareButton() {
    if (!/post\.html/i.test(location.pathname) && !document.querySelector('.post-page')) return;
    var meta = document.querySelector('.post-hero-meta');
    if (!meta || meta.querySelector('.post-share-btn')) return;

    function waitForTitle(tries) {
      tries = tries || 0;
      var t = document.getElementById('post-title');
      if (t && t.textContent && t.textContent.indexOf('Loading') === -1) addBtn(t.textContent);
      else if (tries < 60) setTimeout(function () { waitForTitle(tries + 1); }, 150);
    }

    function addBtn(title) {
      var btn = document.createElement('button');
      btn.className = 'post-share-btn post-meta-item';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Share this post');
      btn.innerHTML = '↗ share';
      meta.appendChild(btn);
      btn.addEventListener('click', function () {
        var url = location.href;
        if (navigator.share) {
          navigator.share({ title: title, url: url }).catch(function () {});
        } else {
          navigator.clipboard && navigator.clipboard.writeText(url).then(function () {
            btn.textContent = '✓ copied!';
            setTimeout(function () { btn.innerHTML = '↗ share'; }, 1800);
          });
        }
      });
    }
    waitForTitle();
  }

  // ─────────────────────────────────────────────
  // feat: last-read dim on blog cards
  // ─────────────────────────────────────────────
  var READ_KEY = 'bensec-read-posts';
  function getReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); }
    catch (e) { return new Set(); }
  }
  function markRead(id) {
    var s = getReadSet(); s.add(id);
    try { localStorage.setItem(READ_KEY, JSON.stringify(Array.from(s))); } catch (e) {}
  }
  function initLastRead() {
    // Mark current post as read
    if (/post\.html/i.test(location.pathname)) {
      var id = new URLSearchParams(location.search).get('id');
      if (id) markRead(id);
      return;
    }
    // On blog page: dim read cards
    var readSet = getReadSet();
    if (!readSet.size) return;
    function dimCards() {
      document.querySelectorAll('.post, .blog-post-card').forEach(function (card) {
        var link = card.querySelector('a[href*="post.html?id="]');
        if (!link) return;
        var m = /id=([^&]+)/.exec(link.getAttribute('href') || '');
        if (!m) return;
        var id = decodeURIComponent(m[1]);
        if (readSet.has(id)) card.classList.add('post-read');
      });
    }
    setTimeout(dimCards, 800);
    setTimeout(dimCards, 2000);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTypewriter();
    initStatusTimer();
    initShareButton();
    initLastRead();
  });
}());
