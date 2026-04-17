// ── Blog Engine ──
// Handles: Firebase Auth, Firestore CRUD for posts/projects/cheatsheets,
// markdown-to-HTML rendering, and dynamic post listing on index.html.

(function () {
  'use strict';

  var DRAFT_KEY = 'bensec_draft';

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Storage — delegates to BensecDB (Firebase) ──
  function getPosts()            { return window.BensecDB ? BensecDB.getPosts()    : []; }
  function savePosts(posts)      { if (window.BensecDB) BensecDB.savePosts(posts); }
  function getProjects()         { return window.BensecDB ? BensecDB.getProjects() : []; }
  function saveProjects(projects){ if (window.BensecDB) BensecDB.saveProjects(projects); }

  // ── Seed default posts (from old site) ──
  var SEED_IDS = ['seed-2', 'seed-3', 'seed-4'];
  function seedDefaultPosts() {
    // Only seed if Firestore has no posts at all
    var existing = getPosts().filter(function (p) { return SEED_IDS.indexOf(p.id) === -1; });
    if (getPosts().length > 0) return; // already has data, don't overwrite
    var defaults = [
      {
        id: 'seed-2',
        title: 'TryHackMe: CMesS',
        date: '2025-05-04',
        tags: 'walkthrough thm cms cronjob pwn root',
        summary: 'Walkthrough of the CMesS room on TryHackMe — exploiting Gila CMS to get a shell, then abusing a wildcard cronjob for root.',
        status: 'published',
        body: `# TryHackMe: CMesS

> https://tryhackme.com/room/cmess — Can you root this Gila CMS box?

![CMesS room](https://github.com/user-attachments/assets/0ad2c03a-f345-4f42-9637-e379685e8592)

## Nmap Scan

For my Nmap scan, I used the \`-A\` flag, which includes: OS detection (\`-O\`), version detection (\`-sV\`), script scanning (\`-sC\`) and traceroute. Analysing the results, I see that the host has an Apache website running and an open SSH port that we can connect to later, when we have credentials.

![Nmap scan results](https://github.com/user-attachments/assets/f1e6287b-61a8-49c4-b385-8a1777c7a5a4)

## Main Webpage

Checking out the website on port 80, we have a Gila CMS page. There is no visible vulnerability here — I can further explore possible file paths and subdomains to find further information.

![Gila CMS homepage](https://github.com/user-attachments/assets/599b115e-c83c-46e6-ba64-7841f042cb23)

## Domain/Subdomain Enumeration

To enumerate file paths, I use Gobuster with a standard directory scan. The results yield a myriad of file paths. After exploring these paths, I found that the \`/admin\` page redirects to a login page. I do not have any credentials for this page, so we will have to explore further.

![Gobuster directory scan](https://github.com/user-attachments/assets/f8f67bb0-b3fd-45f4-ad43-775b4779868a)

Before I begin subdomain enumeration, I added \`cmess.thm\` to \`/etc/hosts\`. I used **wfuzz** to enumerate any possible subdomains and got a hit: \`dev.cmess.thm\`.

![Subdomain enumeration with wfuzz](https://github.com/user-attachments/assets/61596da1-c957-47ce-af84-63839be2b515)

This development page includes user and password credentials for user **Andre**: \`andre@cmess\`. I can use this information to log in to the admin login page.

![dev.cmess.thm credentials](https://github.com/user-attachments/assets/6f61f131-9453-4121-9fe7-03dab9f25926)

## Admin Panel & Exploit

After successfully logging into the CMS, I'm presented with an admin dashboard.

![Admin dashboard](https://github.com/user-attachments/assets/ffe8492f-0e56-4e57-bb74-37f9db5fcacd)

Looking around the admin page, I find a password hash on the \`/admin/users\` page. Copying this into [hashes.com](https://hashes.com/en/tools/hash_identifier) returns a Blowfish hash type — secure and not brute-forceable.

![Blowfish password hash](https://github.com/user-attachments/assets/6a13ee30-f684-4ca9-9241-6147b08f3afd)

Exploring further, I find the **CMS version is 1.10.9**.

![CMS version](https://github.com/user-attachments/assets/77b864e4-4a85-47b0-99c4-928785739b40)

Searching online for "CMS version 1.10.9 exploits," I came across [exploit-db.com/exploits/51569](https://www.exploit-db.com/exploits/51569).

![ExploitDB exploit](https://github.com/user-attachments/assets/b42bafc5-fdb6-402f-9941-13dc83d0b95d)

After fixing a missing module error (\`sudo apt install python3-termcolour\`), I started a reverse listener:

![Exploit error](https://github.com/user-attachments/assets/a860e263-5c92-4142-9178-e575837724ef)

\`\`\`bash
nc -lvnp 4444
\`\`\`

Running the exploit successfully gained a shell as **www-data**.

![Reverse shell obtained](https://github.com/user-attachments/assets/bb9c71d8-4020-464a-ab31-6f92b40f09c9)

![Netcat listener](https://github.com/user-attachments/assets/aee0260e-88e4-4a64-a0e7-fae0062fbbbf)

## Lateral Movement

After gaining access, I want to run Linpeas to find any leaked credentials. First I need a writable directory:

\`\`\`bash
find . -type d -user www-data -print | xargs -0 ls -ld
\`\`\`

![Writable directory owned by www-data](https://github.com/user-attachments/assets/029cc120-78a1-42e1-b9b9-2d8e7ca87385)

I set up a basic HTTP server on my local machine and downloaded Linpeas via wget. After running it, \`/opt/password.bak\` stands out.

![Linpeas output](https://github.com/user-attachments/assets/8526378c-4f50-45ca-bf35-4ddbd9864ba7)

Viewing this file reveals login information for user Andre.

![password.bak contents](https://github.com/user-attachments/assets/87c1e2ee-fcbf-478e-b270-352ce0f20875)

This allows me to SSH in as Andre on port 22.

![SSH as Andre](https://github.com/user-attachments/assets/2336eda4-a503-4c2f-88a0-fde0d56971fe)

**User flag obtained.**

## Privilege Escalation

After searching around the system, I found a suspicious cron job running \`tar\`.

![Crontab](https://github.com/user-attachments/assets/5d456807-62cc-4f66-8d7b-86d39590f0ea)

Checking [GTFObins for tar](https://gtfobins.github.io/gtfobins/tar/), I can exploit this by changing to \`/home/andre/backup\` and creating a \`shell.sh\` that copies bash and gives it SUID permissions:

\`\`\`bash
echo "cp /bin/bash /tmp/bash; chmod +s /tmp/bash" > shell.sh
echo "" > "--checkpoint-action=exec=sh shell.sh"
echo "" > --checkpoint=1
chmod +x shell.sh
\`\`\`

After waiting 1–2 minutes for the cronjob to execute, a \`/tmp/bash\` file spawns. Running it:

\`\`\`bash
/tmp/bash -p
\`\`\`

![Root flag](https://github.com/user-attachments/assets/ead69590-324b-4803-9346-b819006bf4e8)

**Root flag obtained.**`
      },
      {
        id: 'seed-3',
        title: 'Buffer Overflow Task',
        date: '2024-01-21',
        tags: 'guide buffer-overflow exploitation',
        summary: 'A deep-dive into stack-based buffer overflows — covering memory layout, bad character detection, and writing a working exploit.',
        status: 'published',
        body: `# Buffer Overflow Task

## What is a buffer overflow?

A buffer overflow is a memory corruption vulnerability in which a buffer allows more data than its intended storage capacity. As a result, when data is written to the buffer, a portion of it is overwritten in adjacent memory locations. This allows attackers to change the execution path of the program, run arbitrary code or access private files. They can achieve this by intentionally feeding the buffer malicious data, which gets overwritten in memory areas with executable code. The most common example is an attack to overwrite the Instruction Pointer (IP) register to point to an exploit payload, which can gain access to the system.

## Inspection using gdb/gef

We can begin this buffer overflow task by inspecting the executable using **GDB with the GEF extension**. Viewing the functions defined within the program, it is vulnerable as it uses the outdated \`strcpy\` function and is susceptible to buffer overflow attacks.

![GDB/GEF function inspection — strcpy vulnerability](https://github.com/user-attachments/assets/8e6e163e-af5b-4078-937e-446ebb14f79a)

Disassembling the main function gives us an idea of how the program functions.

![Disassembled main function](https://github.com/user-attachments/assets/d94915eb-6032-4ae9-9c9f-07d613598115)

## Finding RIP offset

We begin by finding the offset of the RIP. We do this by generating a pattern using GEF's \`pattern create\` function.

![GEF pattern creation](https://github.com/user-attachments/assets/d9ffd409-6f84-47c7-b655-558e46314a2d)

This works by overwriting the RIP with a unique value, which we can query to find the offset. View the frame information and use the \`pattern offset\` function to find the offset of the overwritten RIP. In this case, we yielded a value of **264 bytes**. This means our buffer is **256 bytes** (264 bytes − 8 bytes for RBP) in size.

Now we can begin to generate our exploit — we will need a NOP sled, shellcode and a return value. We can find our return value by generating a pattern of "A"s to fill the stack and identify the top/bottom memory addresses. Breakpointing the last instruction lets us see where values are written on the stack pointer (RSP).

![Stack overwritten with A values](https://github.com/user-attachments/assets/c3ca6c3c-9669-4d98-8ff4-0ccb063ee6f4)

![Memory address visualization](https://github.com/user-attachments/assets/a01eb897-6c97-44a7-a31e-a9c5292a2e25)

![Stack pointer register view](https://github.com/user-attachments/assets/56fb0c32-a3b2-4e7b-a560-04adf1c5ed4d)

Using the command \`x/24wx $rsp\`, we can view the top of the stack to find where the buffer begins — in this case it starts at memory address \`0x7fffffffdb60\`.

> **Note:** \`x/24wx $rsp\` displays the RSP register as 24 words (4 bytes each)

## NOP sled and Shellcode

To construct our payload, we begin with a **NOP sled** — a sequence of NOP (\`\\x90\`) instructions used to "slide" the execution flow to our shellcode. The NOP instruction tells the computer to do nothing. NOP sleds ensure the CPU reaches the shellcode even if the return address isn't pixel-perfect.

![NOP sled demonstration](https://github.com/user-attachments/assets/366e9ac8-ce63-4295-87c1-06827cd27d1d)

The size of our NOP sled depends on the shellcode size. For example, if our shellcode is 23 bytes, the NOP sled must be 141 bytes long (buffer + RBP = 164 bytes) to fill the remaining space.

**Shellcode** is a set of instructions that executes commands to exploit a vulnerability. A basic example executes \`/bin/sh\` — if the program is misconfigured as SUID, we could get a root shell.

## Crafting the payload

1. **Return address** — Instead of the absolute beginning of the buffer, I used \`0x7fffffffdbe0\` as it is close to the start and less susceptible to errors, guaranteeing redirection to the NOP sled.

2. **Shellcode** — Shellcode can be found online; an example is [exploit-db.com/exploits/46907](https://www.exploit-db.com/exploits/46907).

   > **Warning:** Not all online shellcodes work — you may have to try several. Ensure the shellcode matches your architecture (usually x64/x86_64).

3. **NOP sled** — Length = \`buffer_size - len(shellcode)\`

![Payload file creation](https://github.com/user-attachments/assets/a13e976c-f8c4-4fa4-89fa-0845638d2418)

![Exploit execution](https://github.com/user-attachments/assets/9e37b290-0dcc-40bd-808d-419587862523)

![Shell spawned](https://github.com/user-attachments/assets/0ff2afc6-430d-4c09-bb36-4cd5d17121d7)

We have successfully exploited the buffer, executed our shellcode and spawned a shell.`
      },
      {
        id: 'seed-4',
        title: 'TryHackMe: Agent Sudo',
        date: '2024-01-07',
        tags: 'walkthrough thm forensics pwn root steganography',
        summary: 'Walkthrough of Agent Sudo on TryHackMe — user-agent manipulation, steganography, CVE exploitation, and sudo misconfiguration for root.',
        status: 'published',
        body: `# TryHackMe: Agent Sudo

> "You found a secret server located under the deep sea. Your task is to hack inside the server and reveal the truth."

![Agent Sudo challenge](https://github.com/user-attachments/assets/7122f24f-3555-4bc9-8181-815eab81ecfc)

## Nmap Scan

Nmap reveals three open ports:

- **Port 21** — FTP (vsftpd 3.0.3)
- **Port 22** — SSH (OpenSSH 7.6p1)
- **Port 80** — HTTP (Apache httpd 2.4.29)

## Enumerating HTTP

Initial browser access to port 80 displays a message from "Agent R" instructing visitors to change their user-agent to their codename. Using curl with different user-agent values, user-agent **"C"** reveals a message:

![HTTP user-agent enumeration](https://github.com/user-attachments/assets/c1f4a4be-b945-4a8a-9799-75b6178b16f8)

> "Attention chris, Do you still remember our deal? Please tell agent J about the stuff ASAP. Also, change your god damn password, is weak!"

## FTP Password Cracking

Using Hydra against the FTP service with username **chris**, the password is cracked as **crystal**. The FTP server contains three files including \`To_agentJ.txt\` and two images.

## Image Forensics

The message indicates a password is hidden in an image. Using **Binwalk** on \`cutie.png\`, an encrypted ZIP archive is discovered. After cracking it with zip2john and John the Ripper, the password **"alien"** is found. The extracted file contains base64-encoded text \`QXJlYTUx\`, which decodes to **"Area51"**.

Using **Steghide** with the "Area51" passphrase on \`cute-alien.jpg\` reveals SSH credentials:

- Username: **james**
- Password: **hackerrules!**

One of the files retrieved is an alien autopsy image — running a reverse image search reveals its true identity.

![Alien autopsy image](https://github.com/user-attachments/assets/315b7194-fb69-4513-93bf-6cc0d56c13a3)

![Reverse image search result](https://github.com/user-attachments/assets/8cd0e437-4c60-493b-9ae7-3a0c0cb24082)

**User flag:** \`b03d975e8c92a7c04146cfa7a5a313c7\`

## Privilege Escalation — CVE-2019-14287

Checking sudo privileges:

\`\`\`bash
sudo -l
\`\`\`

Output: \`(ALL, !root) /bin/bash\`

This is vulnerable to **CVE-2019-14287**. When sudo is configured with \`!root\`, using user ID \`-1\` bypasses the restriction entirely:

\`\`\`bash
sudo -u#-1 /bin/bash
\`\`\`

**Root flag:** \`b53a02f55b57d4439e3341834d70c062\``
      }
    ];
    savePosts(defaults.concat(existing));
    localStorage.setItem(SEED_KEY, '1');
  }



  function saveDraft(data) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch {}
  }

  function loadDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); }
    catch { return null; }
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  // ── Syntax highlighting for terminal blocks ──
  function syntaxHighlight(code) {
    // Stash strings first so they don't get double-highlighted
    var strings = [];
    code = code.replace(/"([^"]*?)"/g, function(m, s) {
      strings.push(s);
      return '\x01STR' + (strings.length - 1) + '\x01';
    });
    code = code.replace(/'([^']*?)'/g, function(m, s) {
      strings.push(s);
      return '\x01STR' + (strings.length - 1) + '\x01';
    });

    // Comments (# at start of line)
    code = code.replace(/^(#.*)$/gm, '<span class="syn-comment">$1</span>');

    // IP addresses
    code = code.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g, '<span class="syn-ip">$1</span>');

    // Port numbers (like 22/tcp, 80/tcp)
    code = code.replace(/\b(\d+)\/(tcp|udp)\b/g, '<span class="syn-port">$1/$2</span>');

    // Common commands at start of line
    code = code.replace(/^(\$?\s*)(nmap|gobuster|curl|wget|bash|python|python3|chmod|echo|sudo|cat|ls|cd|mkdir|grep|find|ssh|nc|netcat|ffuf|sqlmap|hydra|john|hashcat|nikto|dirb|enum4linux|crackmapexec|impacket|msfconsole|searchsploit|export|whoami|id|uname|ifconfig|ip)\b/gm, '$1<span class="syn-cmd">$2</span>');

    // Flags (-sV, --script, etc.)
    code = code.replace(/\s(--?[a-zA-Z][\w-]*)/g, ' <span class="syn-flag">$1</span>');

    // URLs
    code = code.replace(/(https?:\/\/[^\s&lt;]+)/g, '<span class="syn-url">$1</span>');

    // Keywords
    code = code.replace(/\b(open|closed|filtered|STATE|SERVICE|VERSION|PORT)\b/g, '<span class="syn-kw">$1</span>');

    // Restore strings
    code = code.replace(/\x01STR(\d+)\x01/g, function(_, i) {
      return '<span class="syn-str">"' + strings[+i] + '"</span>';
    });

    return code;
  }

  // ── Markdown to HTML ──
  function md(text) {
    if (!text) return '';

    // Extract code blocks and tables before escaping
    var codeBlocks = [];
    var tables = [];

    // Stash fenced code blocks
    text = text.replace(/```([\s\S]*?)```/g, function(_, code) {
      var escaped = code.trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      var highlighted = syntaxHighlight(escaped);
      codeBlocks.push('<div class="terminal"><div class="terminal-titlebar"><span class="terminal-dot red"></span><span class="terminal-dot yellow"></span><span class="terminal-dot green"></span></div><pre><code>' + highlighted + '</code></pre></div>');
      return '\x00CODE' + (codeBlocks.length - 1) + '\x00';
    });

    // Stash markdown tables (header | sep | rows)
    text = text.replace(/((?:^|\n)\|.+\|[ \t]*(?:\n\|[-| :]+\|[ \t]*)(?:\n\|.+\|[ \t]*)*)/g, function(tableBlock) {
      var lines = tableBlock.trim().split('\n').filter(Boolean);
      if (lines.length < 2) return tableBlock;
      var headers = lines[0].split('|').filter(function(c){ return c.trim(); });
      var rows = lines.slice(2); // skip separator
      var thead = '<thead><tr>' + headers.map(function(h) {
        return '<th>' + h.trim().replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>') + '</th>';
      }).join('') + '</tr></thead>';
      var tbody = '<tbody>' + rows.map(function(row) {
        var cells = row.split('|').filter(function(c){ return c.trim() !== undefined; }).slice(1,-1);
        return '<tr>' + cells.map(function(c) {
          return '<td>' + c.trim().replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody>';
      tables.push('<table class="md-table">' + thead + tbody + '</table>');
      return '\x00TABLE' + (tables.length - 1) + '\x00';
    });

    // Now escape HTML
    var html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^---$/gm, '<hr>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    html = html.replace(/<\/li>\s*<br>\s*<li>/g, '</li><li>');
    html = html.replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>\s*(<h[123]|<pre|<blockquote|<ul|<img|<hr)/g, '$1');
    html = html.replace(/(<\/h[123]>|<\/pre>|<\/blockquote>|<\/ul>|loading="lazy">|<hr>)\s*<\/p>/g, '$1');

    // Restore stashed blocks
    html = html.replace(/\x00CODE(\d+)\x00/g, function(_, i) { return codeBlocks[+i]; });
    html = html.replace(/\x00TABLE(\d+)\x00/g, function(_, i) { return tables[+i]; });

    return html;
  }

  // ── Toast ──
  function showToast(message) {
    var toast = document.getElementById('admin-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'admin-toast';
      toast.className = 'admin-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(function () { toast.classList.remove('visible'); }, 2500);
  }

  // ══════════════════════════════════
  //  INDEX PAGE — render blog posts
  // ══════════════════════════════════

  function renderPostsOnIndex() {
    var container = document.getElementById('blog-posts');
    if (!container) return;

    var posts = getPosts().filter(function (p) { return p.status !== 'draft'; });
    if (posts.length === 0) return;

    container.innerHTML = '';
    posts.sort(function (a, b) { return b.date.localeCompare(a.date); });

    var display = posts.slice(0, 3);

    display.forEach(function (post) {
      var tags = (post.tags || '').split(/\s+/).filter(Boolean);
      var tagHtml = tags.map(function (t) {
        return '<span class="tag" data-filter="' + t + '">' + t + '</span>';
      }).join('');

      var div = document.createElement('div');
      div.className = 'post reveal';
      div.dataset.tags = post.tags || '';
      div.innerHTML =
        '<span class="post-date">' + post.date + '</span>' +
        '<h3><a href="post.html?id=' + post.id + '">' + escapeHtml(post.title) + '</a></h3>' +
        '<p>' + escapeHtml(post.summary || '') + '</p>' +
        '<div class="post-tags">' + tagHtml + '</div>';
      container.appendChild(div);
    });

    if (typeof revealObserver !== 'undefined') {
      container.querySelectorAll('.reveal').forEach(function (el) { revealObserver.observe(el); });
    }
  }

  // ══════════════════════════════════
  //  HERO STATUS
  // ══════════════════════════════════

  function renderHeroStatus() {
    var el = document.getElementById('hero-status');
    var textEl = document.getElementById('hero-status-text');
    if (!el || !textEl) return;
    var s = window.BensecDB ? BensecDB.getStatus() : null;
    if (s && s.text) {
      textEl.innerHTML = (s.label || 'just hacked') + ': <span class="accent">' + escapeHtml(s.text) + '</span>';
      el.style.display = '';
    }
  }

  // ══════════════════════════════════
  //  BLOG PAGE — render by category
  // ══════════════════════════════════

  var CTF_TAGS = ['ctf', 'walkthrough', 'htb', 'hackthebox', 'thm', 'tryhackme', 'writeup'];

  function isCTFPost(post) {
    var tags = (post.tags || '').toLowerCase().split(/\s+/);
    return tags.some(function (t) { return CTF_TAGS.indexOf(t) !== -1; });
  }

  function renderPostsOnBlog() {
    var ctfContainer   = document.getElementById('blog-ctf-posts');
    var notesContainer = document.getElementById('blog-notes-posts');
    if (!ctfContainer && !notesContainer) return;

    var posts = getPosts().filter(function (p) { return p.status !== 'draft'; });
    if (posts.length === 0) return; // keep placeholders
    posts.sort(function (a, b) { return b.date.localeCompare(a.date); });

    var ctfPosts   = posts.filter(isCTFPost);
    var notesPosts = posts.filter(function (p) { return !isCTFPost(p); });

    function renderInto(container, list, emptyId) {
      if (!container) return;
      container.innerHTML = '';
      var emptyEl = document.getElementById(emptyId);
      if (list.length === 0) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
      }
      if (emptyEl) emptyEl.classList.add('hidden');
      list.forEach(function (post) {
        var tags = (post.tags || '').split(/\s+/).filter(Boolean)
          .map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
        var div = document.createElement('div');
        div.className = 'post reveal';
        div.dataset.tags = post.tags || '';
        div.innerHTML =
          '<span class="post-date">' + post.date + '</span>' +
          '<h3><a href="post.html?id=' + post.id + '">' + escapeHtml(post.title) + '</a></h3>' +
          (post.summary ? '<p>' + escapeHtml(post.summary) + '</p>' : '') +
          '<div class="post-tags">' + tags + '</div>';
        container.appendChild(div);
      });
      if (typeof revealObserver !== 'undefined') {
        container.querySelectorAll('.reveal').forEach(function (el) { revealObserver.observe(el); });
      }
    }

    renderInto(ctfContainer,   ctfPosts,   'ctf-empty');
    renderInto(notesContainer, notesPosts, 'notes-empty');
  }

  // ══════════════════════════════════
  //  INDEX PAGE — render projects
  // ══════════════════════════════════

  function renderProjectsOnIndex() {
    var container = document.getElementById('projects-list');
    if (!container) return;
    var projects = getProjects().filter(function (p) { return p.status !== 'hidden'; });
    if (projects.length === 0) return; // keep static placeholder
    container.innerHTML = '';
    projects.sort(function (a, b) { return (a.order || 99) - (b.order || 99); });
    projects.forEach(function (proj) {
      var tags = (proj.tags || '').split(/\s+/).filter(Boolean)
        .map(function (t) { return '<span>' + escapeHtml(t) + '</span>'; }).join(' · ');
      var sourceLink = proj.url ? '<a href="' + escapeHtml(proj.url) + '" target="_blank">source</a>' : '';
      var div = document.createElement('div');
      div.className = 'project reveal';
      div.innerHTML =
        '<h3>' +
          (proj.icon ? '<span class="project-icon">' + proj.icon + '</span> ' : '') +
          escapeHtml(proj.title) +
        '</h3>' +
        '<p>' + escapeHtml(proj.description || '') + '</p>' +
        '<p class="project-meta">' + tags + (tags && sourceLink ? ' · ' : '') + sourceLink + '</p>';
      container.appendChild(div);
    });
    if (typeof revealObserver !== 'undefined') {
      container.querySelectorAll('.reveal').forEach(function (el) { revealObserver.observe(el); });
    }
  }

  // ══════════════════════════════════
  //  POST PAGE — render single post
  // ══════════════════════════════════

  function renderSinglePost() {
    var body = document.getElementById('post-body-content');
    var titleEl = document.getElementById('post-title');
    if (!body || !titleEl) return;

    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    if (!id) return;

    var posts = getPosts();
    var post = posts.find(function (p) { return p.id === id; });
    if (!post) {
      titleEl.textContent = 'Post not found';
      body.innerHTML = '<p>This post doesn\'t exist.</p>';
      return;
    }

    titleEl.textContent = post.title;
    document.title = post.title + ' | bensec';

    var dateEl = document.getElementById('post-date');
    var tagsEl = document.getElementById('post-tags-container');
    if (dateEl) dateEl.textContent = post.date;
    if (tagsEl) {
      tagsEl.innerHTML = (post.tags || '').split(/\s+/).filter(Boolean)
        .map(function (t) { return '<span class="tag" data-filter="' + t + '">' + t + '</span>'; }).join('');
    }

    var words = (post.body || '').split(/\s+/).length;
    var readTime = Math.max(1, Math.ceil(words / 200));
    var readEl = document.getElementById('post-reading-time');
    if (readEl) readEl.textContent = readTime + ' min read';

    body.innerHTML = md(post.body || '');
  }

  // ══════════════════════════════════
  //  ADMIN — only runs on admin.html
  // ══════════════════════════════════

  function initAdmin() {
    var loginBtn = document.getElementById('login-btn');
    if (!loginBtn) return;
    var loginScreen = document.getElementById('login-screen');
    var dashboard = document.getElementById('admin-dashboard');
    var loginError = document.getElementById('login-error');
    var passwordInput = document.getElementById('admin-password');
    var logoutBtn = document.getElementById('logout-btn');
    var changePwBtn = document.getElementById('change-pw-btn');
    var changePwForm = document.getElementById('change-pw-form');
    var savePwBtn = document.getElementById('save-pw-btn');
    var cancelPwBtn = document.getElementById('cancel-pw-btn');
    var newPwInput = document.getElementById('new-password');

    // Editor elements
    var editorEl = document.getElementById('post-editor');
    var postsList = document.getElementById('posts-list');
    var emptyState = document.getElementById('empty-state');
    var toolbar = document.querySelector('.admin-toolbar');
    var newPostBtn = document.getElementById('new-post-btn');
    var savePostBtn = document.getElementById('save-post-btn');
    var saveDraftBtn = document.getElementById('save-draft-btn');
    var cancelPostBtn = document.getElementById('cancel-post-btn');
    var deleteFromEditorBtn = document.getElementById('delete-from-editor-btn');
    var titleInput = document.getElementById('editor-title');
    var dateInput = document.getElementById('editor-date');
    var tagsInput = document.getElementById('editor-tags');
    var summaryInput = document.getElementById('editor-summary');
    var bodyInput = document.getElementById('editor-body');
    var statusInput = document.getElementById('editor-status');
    var previewPanel = document.getElementById('preview-panel');
    var writePanel = document.getElementById('write-panel');
    var editorHeading = document.getElementById('editor-heading');
    var wordCountEl = document.getElementById('word-count');
    var summaryCountEl = document.getElementById('summary-count');
    var autosaveStatus = document.getElementById('autosave-status');

    // Modal elements
    var deleteModal = document.getElementById('delete-modal');
    var confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    var cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    var deleteModalTitle = document.getElementById('delete-modal-title');

    var editingId = null;
    var pendingDeleteId = null;
    var deleteCallback = null;
    var adminSearchQuery = '';
    var autosaveTimer = null;

    // ── Image token cache (keeps base64 out of the textarea) ──
    var _imageCache = {};
    var _imgCounter = 0;

    function tokenizeImages(text) {
      return (text || '').replace(/!\[([^\]]*)\]\((data:[^)]{20,})\)/g, function(_, alt, dataUrl) {
        var token = 'bensec_img_' + (++_imgCounter);
        _imageCache[token] = dataUrl;
        return '![' + alt + '](' + token + ')';
      });
    }

    function detokenizeImages(text) {
      return (text || '').replace(/!\[([^\]]*)\]\((bensec_img_\d+)\)/g, function(_, alt, token) {
        return _imageCache[token] ? '![' + alt + '](' + _imageCache[token] + ')' : '![' + alt + '](' + token + ')';
      });
    }

    // ── Hero status ──
    var statusLabelSelect = document.getElementById('status-label-select');
    var statusTextInput   = document.getElementById('status-text-input');
    var saveStatusBtn     = document.getElementById('save-status-btn');
    var clearStatusBtn    = document.getElementById('clear-status-btn');

    // Pre-fill from storage
    var stored = window.BensecDB ? BensecDB.getStatus() : null;
    if (stored) {
      if (statusLabelSelect && stored.label) statusLabelSelect.value = stored.label;
      if (statusTextInput && stored.text)    statusTextInput.value = stored.text;
    }

    if (saveStatusBtn) {
      saveStatusBtn.addEventListener('click', function () {
        var text = statusTextInput ? statusTextInput.value.trim() : '';
        var label = statusLabelSelect ? statusLabelSelect.value : 'just hacked';
        if (!text) { showToast('Enter a status first'); return; }
        if (window.BensecDB) BensecDB.saveStatus({ label: label, text: text });
        showToast('Status updated');
      });
    }
    if (clearStatusBtn) {
      clearStatusBtn.addEventListener('click', function () {
        if (window.BensecDB) BensecDB.clearStatus();
        if (statusTextInput) statusTextInput.value = '';
        showToast('Status cleared');
      });
    }

    // ── Export / Import ──
    var exportBtn  = document.getElementById('export-btn');
    var importFile = document.getElementById('import-file');

    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var data = {
          version: 2,
          exported: new Date().toISOString(),
          posts:       getPosts(),
          projects:    getProjects(),
          status:      window.BensecDB ? BensecDB.getStatus() : null,
          cheatsheets: window.BensecDB ? BensecDB.getCS() : []
        };
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'bhsec-backup-' + new Date().toISOString().slice(0,10) + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('Data exported');
      });
    }

    if (importFile) {
      importFile.addEventListener('change', function () {
        var file = importFile.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          try {
            var data = JSON.parse(e.target.result);
            if (!data.version) throw new Error('Invalid file');
            if (data.posts)       savePosts(data.posts);
            if (data.projects)    saveProjects(data.projects);
            if (data.status && window.BensecDB)      BensecDB.saveStatus(data.status);
            if (data.cheatsheets && window.BensecDB) BensecDB.saveCS(data.cheatsheets);
            showToast('Data imported — reloading...');
            setTimeout(function () { location.reload(); }, 1200);
          } catch (err) {
            showToast('Import failed — invalid file');
          }
        };
        reader.readAsText(file);
        importFile.value = '';
      });
    }

    // ── Auth state — Firebase handles session persistence ──
    if (window.BensecDB) {
      BensecDB.onAuthChange(function (user) {
        if (user) {
          loginScreen.classList.add('hidden');
          dashboard.classList.remove('hidden');
          renderAdminPosts();
          updateStats();
        } else {
          loginScreen.classList.remove('hidden');
          dashboard.classList.add('hidden');
        }
      });
    }

    // ── Login ──
    loginBtn.addEventListener('click', function () {
      var pw = passwordInput.value;
      if (!pw) return;
      loginBtn.disabled = true;
      loginBtn.textContent = 'authenticating...';
      BensecDB.login(pw).then(function () {
        loginError.classList.add('hidden');
        passwordInput.value = '';
      }).catch(function (err) {
        loginBtn.disabled = false;
        loginBtn.textContent = 'authenticate';
        loginError.textContent = 'access denied — invalid password';
        loginError.classList.remove('hidden');
        passwordInput.value = '';
        passwordInput.focus();
      });
    });

    passwordInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') loginBtn.click();
    });

    // ── Logout ──
    logoutBtn.addEventListener('click', function () {
      BensecDB.logout().then(function () { location.reload(); });
    });

    // ── Change password (via Firebase) ──
    changePwBtn.addEventListener('click', function () {
      changePwForm.classList.toggle('hidden');
    });
    cancelPwBtn.addEventListener('click', function () {
      changePwForm.classList.add('hidden');
    });
    savePwBtn.addEventListener('click', function () {
      var newPw = newPwInput.value.trim();
      if (!newPw) return;
      var user = firebase.auth().currentUser;
      if (!user) { showToast('Not logged in'); return; }
      user.updatePassword(newPw).then(function () {
        newPwInput.value = '';
        changePwForm.classList.add('hidden');
        showToast('Password updated');
      }).catch(function (e) {
        showToast('Password update failed: ' + e.message);
      });
    });

    // ── Stats ──
    function updateStats() {
      var el = document.getElementById('admin-stats');
      if (!el) return;
      var posts = getPosts();
      var published = posts.filter(function (p) { return p.status !== 'draft'; }).length;
      var drafts = posts.filter(function (p) { return p.status === 'draft'; }).length;
      var totalWords = posts.reduce(function (sum, p) { return sum + (p.body || '').split(/\s+/).length; }, 0);
      el.innerHTML =
        '<span class="admin-stat-chip">' + published + ' published</span>' +
        '<span class="admin-stat-chip draft">' + drafts + ' drafts</span>' +
        '<span class="admin-stat-chip">' + totalWords.toLocaleString() + ' words</span>';
    }

    // ── Search ──
    var adminSearchInput = document.getElementById('admin-search');
    if (adminSearchInput) {
      adminSearchInput.addEventListener('input', function () {
        adminSearchQuery = adminSearchInput.value.trim();
        renderAdminPosts();
      });
    }

    // ── Post list ──
    function renderAdminPosts() {
      var posts = getPosts().sort(function (a, b) { return b.date.localeCompare(a.date); });

      if (adminSearchQuery) {
        var q = adminSearchQuery.toLowerCase();
        posts = posts.filter(function (p) {
          return p.title.toLowerCase().includes(q) ||
            (p.tags || '').toLowerCase().includes(q) ||
            (p.summary || '').toLowerCase().includes(q);
        });
      }

      // No posts at all
      if (posts.length === 0 && !adminSearchQuery) {
        postsList.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
      }

      emptyState.classList.add('hidden');

      // No search results
      if (posts.length === 0) {
        postsList.innerHTML = '<p class="dim" style="font-size:12px; padding:1rem;">No posts match "' + escapeHtml(adminSearchQuery) + '"</p>';
        return;
      }

      postsList.innerHTML = posts.map(function (post) {
        var tags = (post.tags || '').split(/\s+/).filter(Boolean)
          .map(function (t) { return '<span class="tag" data-filter="' + t + '">' + t + '</span>'; }).join(' ');
        var words = (post.body || '').split(/\s+/).length;
        var isDraft = post.status === 'draft';
        var statusBadge = isDraft
          ? '<span class="admin-post-badge draft">draft</span>'
          : '<span class="admin-post-badge published">published</span>';

        return '<div class="admin-post-item" data-id="' + post.id + '">' +
          '<div class="admin-post-info">' +
            '<div class="admin-post-title-row">' +
              '<h4>' + escapeHtml(post.title) + '</h4>' +
              statusBadge +
            '</div>' +
            '<p class="admin-post-meta">' +
              '<span>' + post.date + '</span>' +
              '<span>' + words + ' words</span>' +
              (tags ? '<span>' + tags + '</span>' : '') +
            '</p>' +
            (post.summary ? '<p class="admin-post-summary">' + escapeHtml(post.summary) + '</p>' : '') +
          '</div>' +
          '<div class="admin-post-actions">' +
            '<button class="edit-btn">edit</button>' +
            '<button class="view-btn">' + (isDraft ? 'preview' : 'view') + '</button>' +
            '<button class="dupe-btn">duplicate</button>' +
            '<button class="delete-btn">delete</button>' +
          '</div>' +
        '</div>';
      }).join('');

      // Bind buttons
      postsList.querySelectorAll('.edit-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          editPost(btn.closest('.admin-post-item').dataset.id);
        });
      });

      postsList.querySelectorAll('.view-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.closest('.admin-post-item').dataset.id;
          window.open('post.html?id=' + id, '_blank');
        });
      });

      postsList.querySelectorAll('.dupe-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.closest('.admin-post-item').dataset.id;
          duplicatePost(id);
        });
      });

      postsList.querySelectorAll('.delete-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.closest('.admin-post-item').dataset.id;
          showDeleteConfirm(id, function () {
            var posts = getPosts().filter(function (p) { return p.id !== id; });
            savePosts(posts);
            renderAdminPosts();
            updateStats();
            showToast('Post deleted');
          });
        });
      });
    }

    // ── Duplicate ──
    function duplicatePost(id) {
      var posts = getPosts();
      var original = posts.find(function (p) { return p.id === id; });
      if (!original) return;

      var newPost = {
        id: 'post_' + Date.now(),
        title: original.title + ' (copy)',
        date: new Date().toISOString().split('T')[0],
        tags: original.tags || '',
        summary: original.summary || '',
        body: original.body || '',
        status: 'draft'
      };
      posts.push(newPost);
      savePosts(posts);
      renderAdminPosts();
      updateStats();
      showToast('Post duplicated as draft');
    }

    // ── Delete modal ──
    function showDeleteConfirm(id, callback) {
      var post = getPosts().find(function (p) { return p.id === id; });
      if (!post) return;
      pendingDeleteId = id;
      deleteCallback = callback;
      deleteModalTitle.textContent = 'Are you sure you want to delete "' + post.title + '"? This cannot be undone.';
      deleteModal.classList.remove('hidden');
    }

    confirmDeleteBtn.addEventListener('click', function () {
      if (deleteCallback) {
        deleteCallback();
        deleteCallback = null;
      }
      pendingDeleteId = null;
      deleteModal.classList.add('hidden');
    });

    cancelDeleteBtn.addEventListener('click', function () {
      pendingDeleteId = null;
      deleteCallback = null;
      deleteModal.classList.add('hidden');
    });

    deleteModal.addEventListener('click', function (e) {
      if (e.target === deleteModal) {
        pendingDeleteId = null;
        deleteCallback = null;
        deleteModal.classList.add('hidden');
      }
    });

    // ── New post ──
    newPostBtn.addEventListener('click', function () {
      var draft = loadDraft();
      if (draft && !draft.id && draft.title) {
        if (confirm('You have an unsaved draft: "' + draft.title + '". Restore it?')) {
          editingId = null;
          fillEditor(draft);
          showEditor();
          return;
        }
      }
      clearDraft();
      editingId = null;
      fillEditor({
        title: '',
        date: new Date().toISOString().split('T')[0],
        tags: '',
        summary: '',
        body: '',
        status: 'published'
      });
      showEditor();
    });

    // ── Edit post ──
    function editPost(id) {
      var post = getPosts().find(function (p) { return p.id === id; });
      if (!post) return;
      editingId = id;
      fillEditor(post);
      showEditor();
    }

    function fillEditor(data) {
      titleInput.value = data.title || '';
      dateInput.value = data.date || new Date().toISOString().split('T')[0];
      tagsInput.value = data.tags || '';
      summaryInput.value = data.summary || '';
      bodyInput.value = tokenizeImages(data.body || '');
      statusInput.value = data.status || 'published';
      updateCounts();
    }

    function showEditor() {
      var postsPanel = document.getElementById('posts-panel');
      if (postsPanel) postsPanel.classList.add('hidden');
      editorEl.classList.remove('hidden');
      emptyState.classList.add('hidden');

      editorHeading.textContent = editingId ? 'Edit post' : 'New post';
      savePostBtn.textContent = editingId ? 'update post' : 'publish post';
      deleteFromEditorBtn.style.display = editingId ? '' : 'none';

      setTimeout(function () { titleInput.focus(); }, 100);
    }

    function hideEditor() {
      var postsPanel = document.getElementById('posts-panel');
      if (postsPanel) postsPanel.classList.remove('hidden');
      editorEl.classList.add('hidden');
      writePanel.classList.remove('hidden');
      previewPanel.classList.add('hidden');
      document.querySelectorAll('.editor-tab').forEach(function (t) { t.classList.remove('active'); });
      var writeTab = document.querySelector('.editor-tab[data-tab="write"]');
      if (writeTab) writeTab.classList.add('active');
      clearDraft();
    }

    // ── Cancel editing ──
    cancelPostBtn.addEventListener('click', function () {
      if (bodyInput.value.trim() || titleInput.value.trim()) {
        if (!confirm('Discard unsaved changes?')) return;
      }
      hideEditor();
      renderAdminPosts();
    });

    // ── Save / publish ──
    savePostBtn.addEventListener('click', function () {
      saveCurrentPost('published');
    });

    saveDraftBtn.addEventListener('click', function () {
      saveCurrentPost('draft');
    });

    function saveCurrentPost(status) {
      var title = titleInput.value.trim();
      var date = dateInput.value;
      var tags = tagsInput.value.trim();
      var summary = summaryInput.value.trim();
      var body = detokenizeImages(bodyInput.value);

      if (!title) {
        titleInput.focus();
        titleInput.style.borderColor = 'var(--rose)';
        setTimeout(function () { titleInput.style.borderColor = ''; }, 2000);
        showToast('Title is required');
        return;
      }
      if (!date) {
        dateInput.focus();
        showToast('Date is required');
        return;
      }

      var posts = getPosts();

      if (editingId) {
        var idx = posts.findIndex(function (p) { return p.id === editingId; });
        if (idx !== -1) {
          posts[idx].title = title;
          posts[idx].date = date;
          posts[idx].tags = tags;
          posts[idx].summary = summary;
          posts[idx].body = body;
          posts[idx].status = status;
        }
      } else {
        posts.push({
          id: 'post_' + Date.now(),
          title: title,
          date: date,
          tags: tags,
          summary: summary,
          body: body,
          status: status
        });
      }

      savePosts(posts);
      clearDraft();
      hideEditor();
      editingId = null;
      renderAdminPosts();
      updateStats();
      showToast(status === 'draft' ? 'Saved as draft' : 'Post published');
    }

    // ── Delete from editor ──
    deleteFromEditorBtn.addEventListener('click', function () {
      if (!editingId) return;
      var idToDelete = editingId;
      showDeleteConfirm(idToDelete, function () {
        var posts = getPosts().filter(function (p) { return p.id !== idToDelete; });
        savePosts(posts);
        hideEditor();
        editingId = null;
        renderAdminPosts();
        updateStats();
        showToast('Post deleted');
      });
    });

    // ── Autosave ──
    function triggerAutosave() {
      if (autosaveTimer) clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(function () {
        saveDraft({
          id: editingId,
          title: titleInput.value,
          date: dateInput.value,
          tags: tagsInput.value,
          summary: summaryInput.value,
          body: detokenizeImages(bodyInput.value),
          status: statusInput.value
        });
        if (autosaveStatus) {
          autosaveStatus.textContent = 'draft saved';
          setTimeout(function () { autosaveStatus.textContent = ''; }, 2000);
        }
      }, 2000);
    }

    titleInput.addEventListener('input', triggerAutosave);
    tagsInput.addEventListener('input', triggerAutosave);
    summaryInput.addEventListener('input', function () {
      triggerAutosave();
      updateCounts();
    });
    bodyInput.addEventListener('input', function () {
      triggerAutosave();
      updateCounts();
    });

    // ── Counts ──
    function updateCounts() {
      if (wordCountEl) {
        var words = bodyInput.value.trim() ? bodyInput.value.trim().split(/\s+/).length : 0;
        var mins = Math.max(1, Math.ceil(words / 200));
        wordCountEl.textContent = words + ' words · ~' + mins + ' min read';
      }
      if (summaryCountEl) {
        var len = summaryInput.value.length;
        summaryCountEl.textContent = len + ' / 160 characters';
        summaryCountEl.style.color = len > 160 ? 'var(--rose)' : '';
      }
    }

    // ── Tag suggestions ──
    tagsInput.addEventListener('input', function () {
      var suggestionsEl = document.getElementById('tag-suggestions');
      if (!suggestionsEl) return;

      var allPosts = getPosts();
      var allTags = {};
      allPosts.forEach(function (p) {
        (p.tags || '').split(/\s+/).filter(Boolean).forEach(function (t) { allTags[t] = true; });
      });

      var currentTags = tagsInput.value.split(/\s+/).filter(Boolean);
      var lastTag = currentTags[currentTags.length - 1] || '';

      if (!lastTag) {
        suggestionsEl.innerHTML = '';
        return;
      }

      var suggestions = Object.keys(allTags).filter(function (t) {
        return t.startsWith(lastTag.toLowerCase()) && currentTags.slice(0, -1).indexOf(t) === -1;
      });

      if (suggestions.length === 0) {
        suggestionsEl.innerHTML = '';
        return;
      }

      suggestionsEl.innerHTML = suggestions.map(function (s) {
        return '<button type="button" class="tag-suggestion">' + s + '</button>';
      }).join('');

      suggestionsEl.querySelectorAll('.tag-suggestion').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var base = currentTags.slice(0, -1);
          base.push(btn.textContent);
          tagsInput.value = base.join(' ') + ' ';
          suggestionsEl.innerHTML = '';
          tagsInput.focus();
          triggerAutosave();
        });
      });
    });

    // ── Editor tabs ──
    document.querySelectorAll('.editor-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.editor-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');

        if (tab.dataset.tab === 'preview') {
          writePanel.classList.add('hidden');
          previewPanel.classList.remove('hidden');
          previewPanel.innerHTML = md(detokenizeImages(bodyInput.value));
        } else {
          writePanel.classList.remove('hidden');
          previewPanel.classList.add('hidden');
        }
      });
    });

    // ══════════════════════════════════
    //  TEMPLATES
    // ══════════════════════════════════

    var templateCtfBtn = document.getElementById('template-ctf-btn');

    if (templateCtfBtn) {
      templateCtfBtn.addEventListener('click', function () {
        if ((titleInput.value.trim() || bodyInput.value.trim()) &&
            !confirm('This will replace the current content. Continue?')) return;

        showCtfTemplateModal();
      });
    }

    function showCtfTemplateModal() {
      var existing = document.getElementById('ctf-template-modal');
      if (existing) existing.remove();

      var modal = document.createElement('div');
      modal.id = 'ctf-template-modal';
      modal.className = 'image-url-modal';
      modal.innerHTML =
        '<div class="image-url-modal-content" style="max-width:560px;">' +
          '<h3>🚩 CTF writeup template</h3>' +
          '<div class="ctf-template-grid">' +
            '<div class="editor-group">' +
              '<label>machine / challenge name</label>' +
              '<input type="text" class="editor-input" id="ctf-machine" placeholder="e.g. Headless">' +
            '</div>' +
            '<div class="editor-group" style="grid-column:1/-1">' +
              '<label>machine URL (optional)</label>' +
              '<input type="text" class="editor-input" id="ctf-url" placeholder="https://app.hackthebox.com/machines/Headless">' +
            '</div>' +
            '<div class="editor-group">' +
              '<label>platform</label>' +
              '<select class="editor-input" id="ctf-platform">' +
                '<option value="HackTheBox">HackTheBox</option>' +
                '<option value="TryHackMe">TryHackMe</option>' +
                '<option value="PicoCTF">PicoCTF</option>' +
                '<option value="CTFtime">CTFtime</option>' +
                '<option value="VulnHub">VulnHub</option>' +
                '<option value="PortSwigger">PortSwigger</option>' +
                '<option value="Other">Other</option>' +
              '</select>' +
            '</div>' +
            '<div class="editor-group">' +
              '<label>difficulty</label>' +
              '<select class="editor-input" id="ctf-difficulty">' +
                '<option value="Easy">Easy</option>' +
                '<option value="Medium">Medium</option>' +
                '<option value="Hard">Hard</option>' +
                '<option value="Insane">Insane</option>' +
              '</select>' +
            '</div>' +
            '<div class="editor-group">' +
              '<label>OS / type</label>' +
              '<select class="editor-input" id="ctf-os">' +
                '<option value="Linux">Linux</option>' +
                '<option value="Windows">Windows</option>' +
                '<option value="Web">Web</option>' +
                '<option value="Forensics">Forensics</option>' +
                '<option value="Crypto">Crypto</option>' +
                '<option value="Pwn">Pwn</option>' +
                '<option value="Reversing">Reversing</option>' +
                '<option value="Misc">Misc</option>' +
              '</select>' +
            '</div>' +
            '<div class="editor-group">' +
              '<label>target IP (optional)</label>' +
              '<input type="text" class="editor-input" id="ctf-ip" placeholder="e.g. 10.10.11.8">' +
            '</div>' +
            '<div class="editor-group">' +
              '<label>user flag (optional)</label>' +
              '<input type="text" class="editor-input" id="ctf-user-flag" placeholder="HTB{...}">' +
            '</div>' +
            '<div class="editor-group">' +
              '<label>root / system flag (optional)</label>' +
              '<input type="text" class="editor-input" id="ctf-root-flag" placeholder="HTB{...}">' +
            '</div>' +
            '<div class="editor-group">' +
              '<label>key tools used (space separated)</label>' +
              '<input type="text" class="editor-input" id="ctf-tools" placeholder="nmap gobuster burpsuite">' +
            '</div>' +
          '</div>' +
          '<div class="admin-modal-actions">' +
            '<button class="admin-btn success" id="ctf-template-generate-btn">generate template</button>' +
            '<button class="admin-btn" id="ctf-template-cancel-btn">cancel</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);

      document.getElementById('ctf-template-generate-btn').addEventListener('click', function () {
        var machine    = document.getElementById('ctf-machine').value.trim() || 'Machine Name';
        var platform   = document.getElementById('ctf-platform').value;
        var difficulty = document.getElementById('ctf-difficulty').value;
        var os         = document.getElementById('ctf-os').value;
        var ip         = document.getElementById('ctf-ip').value.trim();
        var url        = document.getElementById('ctf-url').value.trim();
        var userFlag   = document.getElementById('ctf-user-flag').value.trim();
        var rootFlag   = document.getElementById('ctf-root-flag').value.trim();
        var tools      = document.getElementById('ctf-tools').value.trim();

        var today = new Date().toISOString().split('T')[0];
        var toolList = tools ? tools.split(/\s+/).map(function(t) { return '- `' + t + '`'; }).join('\n') : '- `nmap`\n- `gobuster`';

        var template =
'## 🖥️ Machine Info\n\n' +
'| Field | Details |\n' +
'|---|---|\n' +
'| **Platform** | ' + platform + ' |\n' +
'| **Difficulty** | ' + difficulty + ' |\n' +
'| **OS** | ' + os + ' |\n' +
(ip ? '| **IP** | `' + ip + '` |\n' : '') +
'| **Date** | ' + today + ' |\n' +
(url ? '| **URL** | [' + machine + '](' + url + ') |\n' : '') +
'\n## 🔧 Tools Used\n\n' +
toolList + '\n\n' +
'## 📋 Summary\n\n' +
'> Brief overview of the machine and what makes it interesting. What did you learn?\n\n' +
'---\n\n' +
'## 🔍 Enumeration\n\n' +
'### 📡 Nmap Scan\n\n' +
'```\n# nmap results here\n```\n\n' +
'**Open ports:**\n\n' +
'- `PORT` — service\n\n' +
'### 🌐 Web Enumeration\n\n' +
'```\n# directory/vhost fuzzing results\n```\n\n' +
'---\n\n' +
'## 🚪 Foothold\n\n' +
'Describe the initial access vector here.\n\n' +
'```\n# commands used\n```\n\n' +
'---\n\n' +
'## ⬆️ Privilege Escalation\n\n' +
'Describe the privesc path here.\n\n' +
'```\n# commands used\n```\n\n' +
'---\n\n' +
'## 🚩 Flags\n\n' +
'| Flag | Hash |\n' +
'|---|---|\n' +
'| **User** | `' + (userFlag || 'HTB{...}') + '` |\n' +
'| **Root** | `' + (rootFlag || 'HTB{...}') + '` |\n\n' +
'---\n\n' +
'## 💡 Key Takeaways\n\n' +
'- Lesson 1\n' +
'- Lesson 2\n' +
'- Lesson 3\n';

        // Fill editor
        titleInput.value = machine + ' — ' + platform + ' ' + difficulty + ' Writeup';
        dateInput.value = today;
        tagsInput.value = 'walkthrough ' + platform.toLowerCase() + ' ' + os.toLowerCase() + ' ' + difficulty.toLowerCase();
        summaryInput.value = difficulty + ' ' + os + ' machine on ' + platform + '. ' + (tools ? 'Tools: ' + tools.split(/\s+/).slice(0, 3).join(', ') + '.' : '');
        bodyInput.value = template;
        statusInput.value = 'draft';
        updateCounts();
        triggerAutosave();
        modal.remove();
        showToast('CTF template loaded — good luck!');
      });

      document.getElementById('ctf-template-cancel-btn').addEventListener('click', function () { modal.remove(); });
      modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });

      setTimeout(function () { document.getElementById('ctf-machine').focus(); }, 100);
    }

    // ══════════════════════════════════
    //  IMAGE UPLOAD
    // ══════════════════════════════════

    var imageUploadInput = document.getElementById('image-upload');
    var insertImageBtn = document.getElementById('insert-image-btn');
    var insertUrlImageBtn = document.getElementById('insert-url-image-btn');
    var dropzone = document.getElementById('editor-dropzone');
    var MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
    var MAX_IMAGE_WIDTH = 1200; // resize to this max width

    // Open file picker
    if (insertImageBtn && imageUploadInput) {
      insertImageBtn.addEventListener('click', function () {
        imageUploadInput.click();
      });

      imageUploadInput.addEventListener('change', function () {
        if (imageUploadInput.files.length > 0) {
          handleImageFiles(Array.from(imageUploadInput.files));
          imageUploadInput.value = '';
        }
      });
    }

    // Insert image from URL
    if (insertUrlImageBtn) {
      insertUrlImageBtn.addEventListener('click', function () {
        showImageUrlModal();
      });
    }

    function showImageUrlModal() {
      var existing = document.getElementById('image-url-modal');
      if (existing) existing.remove();

      var modal = document.createElement('div');
      modal.id = 'image-url-modal';
      modal.className = 'image-url-modal';
      modal.innerHTML =
        '<div class="image-url-modal-content">' +
          '<h3>🔗 Insert image from URL</h3>' +
          '<div class="editor-group">' +
            '<label>image URL</label>' +
            '<input type="text" class="editor-input" id="image-url-input" placeholder="https://example.com/image.png">' +
          '</div>' +
          '<div class="editor-group">' +
            '<label>alt text (optional)</label>' +
            '<input type="text" class="editor-input" id="image-alt-input" placeholder="Description of the image">' +
          '</div>' +
          '<div class="admin-modal-actions">' +
            '<button class="admin-btn success" id="image-url-insert-btn">insert</button>' +
            '<button class="admin-btn" id="image-url-cancel-btn">cancel</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);

      var urlInput = document.getElementById('image-url-input');
      var altInput = document.getElementById('image-alt-input');

      document.getElementById('image-url-insert-btn').addEventListener('click', function () {
        var url = urlInput.value.trim();
        if (!url) { urlInput.focus(); return; }
        var alt = altInput.value.trim() || 'image';
        insertTextAtCursor('\n![' + alt + '](' + url + ')\n');
        modal.remove();
        showToast('Image inserted');
      });

      document.getElementById('image-url-cancel-btn').addEventListener('click', function () {
        modal.remove();
      });

      modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.remove();
      });

      setTimeout(function () { urlInput.focus(); }, 100);
    }

    // Drag and drop on the textarea
    if (bodyInput && dropzone) {
      var dragCounter = 0;

      bodyInput.addEventListener('dragenter', function (e) {
        e.preventDefault();
        dragCounter++;
        dropzone.classList.remove('hidden');
        dropzone.classList.add('drag-over');
      });

      bodyInput.addEventListener('dragover', function (e) {
        e.preventDefault();
      });

      bodyInput.addEventListener('dragleave', function (e) {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          dropzone.classList.add('hidden');
          dropzone.classList.remove('drag-over');
        }
      });

      bodyInput.addEventListener('drop', function (e) {
        e.preventDefault();
        dragCounter = 0;
        dropzone.classList.add('hidden');
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
          var imageFiles = Array.from(e.dataTransfer.files).filter(function (f) {
            return f.type.startsWith('image/');
          });
          if (imageFiles.length > 0) handleImageFiles(imageFiles);
        }
      });

      // Also handle drop on the dropzone itself
      dropzone.addEventListener('dragover', function (e) { e.preventDefault(); });
      dropzone.addEventListener('drop', function (e) {
        e.preventDefault();
        dragCounter = 0;
        dropzone.classList.add('hidden');
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
          var imageFiles = Array.from(e.dataTransfer.files).filter(function (f) {
            return f.type.startsWith('image/');
          });
          if (imageFiles.length > 0) handleImageFiles(imageFiles);
        }
      });
    }

    // Paste images from clipboard
    if (bodyInput) {
      bodyInput.addEventListener('paste', function (e) {
        var items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        var imageFiles = [];
        for (var i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            imageFiles.push(items[i].getAsFile());
          }
        }
        if (imageFiles.length > 0) {
          e.preventDefault();
          handleImageFiles(imageFiles);
        }
      });
    }

    // Process image files — resize & compress to base64
    function handleImageFiles(files) {
      var count = 0;
      var total = files.length;

      files.forEach(function (file) {
        if (file.size > MAX_IMAGE_SIZE) {
          showToast('Skipped "' + file.name + '" — exceeds 2MB');
          count++;
          return;
        }
        if (!file.type.startsWith('image/')) {
          count++;
          return;
        }

        var reader = new FileReader();
        reader.onload = function (e) {
          var img = new Image();
          img.onload = function () {
            // Resize if too large
            var canvas = document.createElement('canvas');
            var w = img.width;
            var h = img.height;
            if (w > MAX_IMAGE_WIDTH) {
              h = Math.round(h * (MAX_IMAGE_WIDTH / w));
              w = MAX_IMAGE_WIDTH;
            }
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);

            // Compress as JPEG for photos, PNG for small/transparent images
            var dataUrl;
            if (file.type === 'image/png' && file.size < 200000) {
              dataUrl = canvas.toDataURL('image/png');
            } else {
              dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            }

            var altText = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
            var imgToken = 'bensec_img_' + (++_imgCounter);
            _imageCache[imgToken] = dataUrl;
            insertTextAtCursor('\n![' + altText + '](' + imgToken + ')\n');

            count++;
            if (count === total) {
              showToast(total === 1 ? 'Image inserted' : total + ' images inserted');
              triggerAutosave();
            }
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    // Insert text at the cursor position in the body textarea
    function insertTextAtCursor(text) {
      var start = bodyInput.selectionStart;
      var end = bodyInput.selectionEnd;
      var before = bodyInput.value.substring(0, start);
      var after = bodyInput.value.substring(end);
      bodyInput.value = before + text + after;
      bodyInput.selectionStart = bodyInput.selectionEnd = start + text.length;
      bodyInput.focus();
      updateCounts();
    }
  }

  // ══════════════════════════════════
  //  PROJECT ADMIN (admin.html only)
  // ══════════════════════════════════

  function initProjectAdmin() {
    var tab = document.getElementById('tab-projects');
    var tabPosts = document.getElementById('tab-posts');
    var projectsPanel = document.getElementById('projects-panel');
    var postsPanel = document.getElementById('posts-panel');
    if (!tab || !projectsPanel) return;

    // Tab switching
    function hideAllPanels() {
      postsPanel.classList.add('hidden');
      projectsPanel.classList.remove('hidden');
      // also handle cheatsheets
      var csPanel = document.getElementById('cheatsheets-panel');
      if (csPanel) csPanel.classList.add('hidden');
    }
    function clearAllTabActive() {
      tabPosts.classList.remove('active');
      tab.classList.remove('active');
      var tabCS = document.getElementById('tab-cheatsheets');
      if (tabCS) tabCS.classList.remove('active');
    }

    tab.addEventListener('click', function () {
      clearAllTabActive();
      tab.classList.add('active');
      var csPanel = document.getElementById('cheatsheets-panel');
      if (csPanel) csPanel.classList.add('hidden');
      postsPanel.classList.add('hidden');
      projectsPanel.classList.remove('hidden');
      renderProjectsAdmin();
    });
    tabPosts.addEventListener('click', function () {
      clearAllTabActive();
      tabPosts.classList.add('active');
      postsPanel.classList.remove('hidden');
      projectsPanel.classList.add('hidden');
      var csPanel = document.getElementById('cheatsheets-panel');
      if (csPanel) csPanel.classList.add('hidden');
    });

    // New project button
    var newProjBtn = document.getElementById('new-project-btn');
    if (newProjBtn) newProjBtn.addEventListener('click', function () { showProjectEditor(null); });

    function renderProjectsAdmin() {
      var list = document.getElementById('projects-admin-list');
      var empty = document.getElementById('projects-empty-state');
      if (!list) return;
      var projects = getProjects().sort(function (a, b) { return (a.order || 99) - (b.order || 99); });

      if (projects.length === 0) {
        list.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
      }
      if (empty) empty.classList.add('hidden');

      list.innerHTML = projects.map(function (proj) {
        var badge = proj.status === 'hidden'
          ? '<span class="admin-post-badge draft">hidden</span>'
          : '<span class="admin-post-badge published">visible</span>';
        return '<div class="admin-post-item" data-id="' + proj.id + '">' +
          '<div class="admin-post-info">' +
            '<div class="admin-post-title-row">' +
              '<h4>' + (proj.icon ? proj.icon + ' ' : '') + escapeHtml(proj.title) + '</h4>' +
              badge +
            '</div>' +
            '<p class="admin-post-meta">' +
              '<span>' + escapeHtml(proj.tags || '') + '</span>' +
              (proj.url ? '<span><a href="' + escapeHtml(proj.url) + '" target="_blank">↗ link</a></span>' : '') +
            '</p>' +
            (proj.description ? '<p class="admin-post-summary">' + escapeHtml(proj.description) + '</p>' : '') +
          '</div>' +
          '<div class="admin-post-actions">' +
            '<button class="proj-edit-btn">edit</button>' +
            '<button class="proj-delete-btn">delete</button>' +
          '</div>' +
        '</div>';
      }).join('');

      list.querySelectorAll('.proj-edit-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          showProjectEditor(btn.closest('.admin-post-item').dataset.id);
        });
      });
      list.querySelectorAll('.proj-delete-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.closest('.admin-post-item').dataset.id;
          var proj = getProjects().find(function (p) { return p.id === id; });
          if (!proj) return;
          pendingDeleteId = id;
          deleteCallback = function () {
            saveProjects(getProjects().filter(function (p) { return p.id !== id; }));
            renderProjectsAdmin();
            showToast('Project deleted');
          };
          deleteModalTitle.textContent = 'Delete "' + proj.title + '"? This cannot be undone.';
          deleteModal.classList.remove('hidden');
        });
      });
    }

    function showProjectEditor(id) {
      var proj = id ? getProjects().find(function (p) { return p.id === id; }) : null;
      var existing = document.getElementById('project-editor-modal');
      if (existing) existing.remove();

      var modal = document.createElement('div');
      modal.id = 'project-editor-modal';
      modal.className = 'image-url-modal';
      modal.innerHTML =
        '<div class="image-url-modal-content" style="max-width:520px;">' +
          '<h3>' + (proj ? '✏️ Edit Project' : '➕ New Project') + '</h3>' +
          '<div class="editor-group">' +
            '<label>title</label>' +
            '<input type="text" class="editor-input" id="proj-title" placeholder="My Tool" value="' + escapeHtml(proj ? proj.title : '') + '">' +
          '</div>' +
          '<div class="editor-row">' +
            '<div class="editor-group" style="flex:0 0 80px;">' +
              '<label>icon</label>' +
              '<input type="text" class="editor-input" id="proj-icon" placeholder="📡" value="' + escapeHtml(proj ? (proj.icon || '') : '') + '" style="text-align:center; font-size:20px;">' +
            '</div>' +
            '<div class="editor-group" style="flex:1;">' +
              '<label>status</label>' +
              '<select class="editor-input" id="proj-status">' +
                '<option value="visible"' + (!proj || proj.status !== 'hidden' ? ' selected' : '') + '>Visible</option>' +
                '<option value="hidden"' + (proj && proj.status === 'hidden' ? ' selected' : '') + '>Hidden</option>' +
              '</select>' +
            '</div>' +
            '<div class="editor-group" style="flex:0 0 70px;">' +
              '<label>order</label>' +
              '<input type="number" class="editor-input" id="proj-order" min="1" max="99" value="' + (proj ? (proj.order || 1) : getProjects().length + 1) + '">' +
            '</div>' +
          '</div>' +
          '<div class="editor-group">' +
            '<label>description</label>' +
            '<input type="text" class="editor-input" id="proj-description" placeholder="What does it do?" value="' + escapeHtml(proj ? (proj.description || '') : '') + '">' +
          '</div>' +
          '<div class="editor-group">' +
            '<label>tags (space separated)</label>' +
            '<input type="text" class="editor-input" id="proj-tags" placeholder="python networking cli" value="' + escapeHtml(proj ? (proj.tags || '') : '') + '">' +
          '</div>' +
          '<div class="editor-group">' +
            '<label>source / URL (optional)</label>' +
            '<input type="text" class="editor-input" id="proj-url" placeholder="https://github.com/..." value="' + escapeHtml(proj ? (proj.url || '') : '') + '">' +
          '</div>' +
          '<div class="admin-modal-actions">' +
            '<button class="admin-btn success" id="proj-save-btn">' + (proj ? 'save changes' : 'add project') + '</button>' +
            '<button class="admin-btn" id="proj-cancel-btn">cancel</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);

      document.getElementById('proj-save-btn').addEventListener('click', function () {
        var title = document.getElementById('proj-title').value.trim();
        if (!title) { document.getElementById('proj-title').focus(); showToast('Title is required'); return; }
        var projects = getProjects();
        var data = {
          id: proj ? proj.id : 'proj_' + Date.now(),
          title: title,
          icon: document.getElementById('proj-icon').value.trim(),
          description: document.getElementById('proj-description').value.trim(),
          tags: document.getElementById('proj-tags').value.trim(),
          url: document.getElementById('proj-url').value.trim(),
          status: document.getElementById('proj-status').value,
          order: parseInt(document.getElementById('proj-order').value) || 1
        };
        if (proj) {
          var idx = projects.findIndex(function (p) { return p.id === proj.id; });
          if (idx !== -1) projects[idx] = data;
        } else {
          projects.push(data);
        }
        saveProjects(projects);
        modal.remove();
        renderProjectsAdmin();
        showToast(proj ? 'Project updated' : 'Project added');
      });

      document.getElementById('proj-cancel-btn').addEventListener('click', function () { modal.remove(); });
      modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
      setTimeout(function () { document.getElementById('proj-title').focus(); }, 100);
    }
  }

  // ══════════════════════════════════
  //  CHEATSHEET ADMIN
  // ══════════════════════════════════

  function initCheatsheetAdmin() {
    var CS_KEY = 'bensec_cheatsheets';
    var tab = document.getElementById('tab-cheatsheets');
    var tabPosts = document.getElementById('tab-posts');
    var tabProjects = document.getElementById('tab-projects');
    var panel = document.getElementById('cheatsheets-panel');
    var postsPanel = document.getElementById('posts-panel');
    var projectsPanel = document.getElementById('projects-panel');
    if (!tab || !panel) return;

    function getCS()          { return window.BensecDB ? BensecDB.getCS()     : []; }
    function saveCS(data)     { if (window.BensecDB)   BensecDB.saveCS(data);      }

    // Tab switch
    tab.addEventListener('click', function () {
      tab.classList.add('active');
      tabPosts.classList.remove('active');
      tabProjects.classList.remove('active');
      panel.classList.remove('hidden');
      postsPanel.classList.add('hidden');
      if (projectsPanel) projectsPanel.classList.add('hidden');
      renderCSAdmin();
    });

    // New section button
    var newBtn = document.getElementById('new-cs-section-btn');
    if (newBtn) newBtn.addEventListener('click', function () { showSectionModal(null); });

    function renderCSAdmin() {
      var list = document.getElementById('cs-sections-list');
      var empty = document.getElementById('cs-empty-state');
      if (!list) return;
      var sections = getCS();
      if (!sections.length) {
        list.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
      }
      if (empty) empty.classList.add('hidden');

      list.innerHTML = sections.map(function (sec, si) {
        var groupRows = (sec.groups || []).map(function (g, gi) {
          return '<div class="cs-admin-group" data-si="' + si + '" data-gi="' + gi + '">' +
            '<span class="cs-admin-group-heading">' + escapeHtml(g.heading) + '</span>' +
            '<span class="cs-admin-group-cmd">' + escapeHtml(g.command || '') + '</span>' +
            '<div class="cs-admin-group-actions">' +
              '<button class="admin-btn cs-edit-group-btn" style="padding:0.2rem 0.6rem; font-size:11px;">edit</button>' +
              '<button class="admin-btn danger cs-del-group-btn" style="padding:0.2rem 0.6rem; font-size:11px;">✕</button>' +
            '</div>' +
          '</div>';
        }).join('');

        return '<div class="cs-admin-section" data-si="' + si + '">' +
          '<div class="cs-admin-section-header">' +
            '<span class="cs-admin-section-label">' + escapeHtml(sec.label) + '</span>' +
            '<div style="display:flex; gap:0.4rem; align-items:center;">' +
              (sec.type !== 'ports' ? '<button class="admin-btn success cs-add-group-btn" style="padding:0.25rem 0.75rem; font-size:11px;" data-si="' + si + '">+ command</button>' : '') +
              '<button class="admin-btn cs-edit-section-btn" style="padding:0.25rem 0.75rem; font-size:11px;" data-si="' + si + '">edit</button>' +
              '<button class="admin-btn danger cs-del-section-btn" style="padding:0.25rem 0.75rem; font-size:11px;" data-si="' + si + '">delete</button>' +
            '</div>' +
          '</div>' +
          (sec.type !== 'ports' ?
            '<div class="cs-admin-groups">' + (groupRows || '<p class="dim" style="font-size:12px; padding:0.5rem 0;">No commands yet — click "+ command"</p>') + '</div>'
          : '<p class="dim" style="font-size:12px; padding:0.5rem 1rem;">Built-in port reference table (not editable)</p>') +
        '</div>';
      }).join('');

      // Bind section edit
      list.querySelectorAll('.cs-edit-section-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { showSectionModal(parseInt(btn.dataset.si)); });
      });
      // Bind section delete
      list.querySelectorAll('.cs-del-section-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var si = parseInt(btn.dataset.si);
          var sections = getCS();
          pendingDeleteId = si;
          deleteCallback = function () {
            sections.splice(si, 1);
            saveCS(sections);
            renderCSAdmin();
            showToast('Section deleted');
          };
          deleteModalTitle.textContent = 'Delete section "' + sections[si].label + '"? This cannot be undone.';
          deleteModal.classList.remove('hidden');
        });
      });
      // Bind add command
      list.querySelectorAll('.cs-add-group-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { showGroupModal(parseInt(btn.dataset.si), null); });
      });
      // Bind edit command
      list.querySelectorAll('.cs-edit-group-btn').forEach(function (btn) {
        var row = btn.closest('.cs-admin-group');
        btn.addEventListener('click', function () { showGroupModal(parseInt(row.dataset.si), parseInt(row.dataset.gi)); });
      });
      // Bind delete command
      list.querySelectorAll('.cs-del-group-btn').forEach(function (btn) {
        var row = btn.closest('.cs-admin-group');
        btn.addEventListener('click', function () {
          var si = parseInt(row.dataset.si), gi = parseInt(row.dataset.gi);
          var sections = getCS();
          sections[si].groups.splice(gi, 1);
          saveCS(sections);
          renderCSAdmin();
          showToast('Command deleted');
        });
      });
    }

    function showSectionModal(si) {
      var sections = getCS();
      var sec = si !== null ? sections[si] : null;
      var existing = document.getElementById('cs-section-modal');
      if (existing) existing.remove();

      var modal = document.createElement('div');
      modal.id = 'cs-section-modal';
      modal.className = 'image-url-modal';
      modal.innerHTML =
        '<div class="image-url-modal-content" style="max-width:440px;">' +
          '<h3>' + (sec ? '✏️ Edit Section' : '➕ New Section') + '</h3>' +
          '<div class="editor-group">' +
            '<label>label (emoji + name)</label>' +
            '<input type="text" class="editor-input" id="cs-sec-label" placeholder="🔍 My Section" value="' + escapeHtml(sec ? sec.label : '') + '">' +
          '</div>' +
          (sec ? '' :
            '<div class="editor-group">' +
              '<label>type</label>' +
              '<select class="editor-input" id="cs-sec-type">' +
                '<option value="commands">Commands</option>' +
                '<option value="ports">Ports (built-in table)</option>' +
              '</select>' +
            '</div>'
          ) +
          '<div class="admin-modal-actions">' +
            '<button class="admin-btn success" id="cs-sec-save-btn">' + (sec ? 'save' : 'create') + '</button>' +
            '<button class="admin-btn" id="cs-sec-cancel-btn">cancel</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);

      document.getElementById('cs-sec-save-btn').addEventListener('click', function () {
        var label = document.getElementById('cs-sec-label').value.trim();
        if (!label) { document.getElementById('cs-sec-label').focus(); showToast('Label required'); return; }
        var sections = getCS();
        if (sec) {
          sections[si].label = label;
        } else {
          var typeEl = document.getElementById('cs-sec-type');
          sections.push({ id: 'sec_' + Date.now(), label: label, type: typeEl ? typeEl.value : 'commands', groups: [] });
        }
        saveCS(sections);
        modal.remove();
        renderCSAdmin();
        showToast(sec ? 'Section updated' : 'Section created');
      });
      document.getElementById('cs-sec-cancel-btn').addEventListener('click', function () { modal.remove(); });
      modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
      setTimeout(function () { document.getElementById('cs-sec-label').focus(); }, 100);
    }

    function showGroupModal(si, gi) {
      var sections = getCS();
      var group = gi !== null ? sections[si].groups[gi] : null;
      var existing = document.getElementById('cs-group-modal');
      if (existing) existing.remove();

      var modal = document.createElement('div');
      modal.id = 'cs-group-modal';
      modal.className = 'image-url-modal';
      modal.innerHTML =
        '<div class="image-url-modal-content" style="max-width:520px;">' +
          '<h3>' + (group ? '✏️ Edit Command' : '➕ New Command') + '</h3>' +
          '<div class="editor-group">' +
            '<label>heading / label</label>' +
            '<input type="text" class="editor-input" id="cs-grp-heading" placeholder="e.g. Bash reverse shell" value="' + escapeHtml(group ? group.heading : '') + '">' +
          '</div>' +
          '<div class="editor-group">' +
            '<label>command</label>' +
            '<textarea class="editor-input" id="cs-grp-command" rows="4" placeholder="your command here..." style="resize:vertical; font-family:var(--mono); font-size:12px;">' + escapeHtml(group ? group.command : '') + '</textarea>' +
          '</div>' +
          '<div class="admin-modal-actions">' +
            '<button class="admin-btn success" id="cs-grp-save-btn">' + (group ? 'save' : 'add') + '</button>' +
            '<button class="admin-btn" id="cs-grp-cancel-btn">cancel</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);

      document.getElementById('cs-grp-save-btn').addEventListener('click', function () {
        var heading = document.getElementById('cs-grp-heading').value.trim();
        var command = document.getElementById('cs-grp-command').value.trim();
        if (!heading) { document.getElementById('cs-grp-heading').focus(); showToast('Heading required'); return; }
        if (!command) { document.getElementById('cs-grp-command').focus(); showToast('Command required'); return; }
        var sections = getCS();
        if (group) {
          sections[si].groups[gi].heading = heading;
          sections[si].groups[gi].command = command;
        } else {
          sections[si].groups.push({ id: 'g_' + Date.now(), heading: heading, command: command });
        }
        saveCS(sections);
        modal.remove();
        renderCSAdmin();
        showToast(group ? 'Command updated' : 'Command added');
      });
      document.getElementById('cs-grp-cancel-btn').addEventListener('click', function () { modal.remove(); });
      modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
      setTimeout(function () { document.getElementById('cs-grp-heading').focus(); }, 100);
    }
  }

  // ── Init (runs on every page) ──
  // Load Firebase data first, then render everything
  (window.BensecDB ? BensecDB.init() : Promise.resolve(false)).then(function () {
    seedDefaultPosts();
    renderHeroStatus();
    renderPostsOnIndex();
    renderPostsOnBlog();
    renderProjectsOnIndex();
    renderSinglePost();

    if (document.getElementById('admin-dashboard')) initAdmin();
    if (document.getElementById('admin-dashboard')) initProjectAdmin();
    if (document.getElementById('admin-dashboard')) initCheatsheetAdmin();
  });

  window.blogEngine = { getPosts: getPosts, savePosts: savePosts, md: md, renderPostsOnIndex: renderPostsOnIndex };
})();
