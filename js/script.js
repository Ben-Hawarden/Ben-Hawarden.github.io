// ── Mobile menu ──
const menuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');

if (menuBtn && navLinks) {
  // feat: a11y — aria-expanded toggling
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-controls', 'primary-nav');
  if (!navLinks.id) navLinks.id = 'primary-nav';
  menuBtn.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

// feat: PWA — register service worker
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () { /* no-op */ });
  });
}

// ── Dark / Light theme toggle ──
const root = document.documentElement;
const saved = localStorage.getItem('theme');
if (saved) root.setAttribute('data-theme', saved);

document.querySelectorAll('.theme-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
});

// ── Typing animation (instant — no flash) ──
document.querySelectorAll('.typing').forEach(el => {
  const text = el.dataset.text || el.textContent || '';
  el.textContent = text;
  el.classList.add('done');
});

// ── Static background (matrix rain disabled) ──
(function initBg() {
  const canvas = document.getElementById('matrix-bg');
  if (!canvas) return;
  canvas.style.display = 'none';
})();

// ── Scroll reveal ──
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => {
  revealObserver.observe(el);
});

// ── Page transitions ──
const transition = document.querySelector('.page-transition');
if (transition) {
  // Fade in on load
  document.addEventListener('DOMContentLoaded', () => {
    transition.classList.remove('active');
  });

  // Fade out on nav click
  document.querySelectorAll('a[href]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      // Only intercept local page links, not anchors or external
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || href === '#') return;

      e.preventDefault();
      transition.classList.add('active');
      setTimeout(() => {
        window.location.href = href;
      }, 300);
    });
  });
}

// ── Blog search ──
const searchInput = document.getElementById('blog-search');
const noResults = document.getElementById('no-results');

function filterPosts() {
  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const activeFilter = document.querySelector('.tag-btn.active');
  const filter = activeFilter ? activeFilter.dataset.filter : 'all';
  const posts = document.querySelectorAll('#blog-posts .post');
  let visible = 0;

  posts.forEach(post => {
    const text = post.textContent.toLowerCase();
    const tags = (post.dataset.tags || '').toLowerCase();

    const matchesSearch = !q || text.includes(q) || tags.includes(q);
    const matchesFilter = filter === 'all' || tags.includes(filter);
    const show = matchesSearch && matchesFilter;

    post.classList.toggle('search-hidden', !show);
    if (show) visible++;
  });

  if (noResults) {
    noResults.classList.toggle('hidden', visible > 0);
  }
}

if (searchInput) {
  searchInput.addEventListener('input', filterPosts);
}

// ── Tag filter buttons ──
document.querySelectorAll('.tag-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterPosts();
  });
});

// Clickable tags on posts
document.querySelectorAll('.post-tags .tag').forEach(tag => {
  tag.addEventListener('click', () => {
    const filter = tag.dataset.filter;
    document.querySelectorAll('.tag-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === filter);
    });
    filterPosts();

    // Scroll to filter bar
    const filterBar = document.querySelector('.tag-filters');
    if (filterBar) filterBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});

// ── Copy to clipboard ──
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const code = btn.closest('.code-block').querySelector('code');
    if (!code) return;

    navigator.clipboard.writeText(code.textContent).then(() => {
      btn.textContent = 'copied';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'copy';
        btn.classList.remove('copied');
      }, 1500);
    });
  });
});
