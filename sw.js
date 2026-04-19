// ── Service Worker: stale-while-revalidate ──
// feat: PWA support
const CACHE = 'bensec-v1';
const CORE = [
  '/',
  '/index.html',
  '/blog.html',
  '/post.html',
  '/cheatsheets.html',
  '/resources.html',
  '/now.html',
  '/uses.html',
  '/404.html',
  '/css/style.css',
  '/js/script.js',
  '/js/blog-engine.js',
  '/js/firebase-db.js',
  '/js/firebase-config.js',
  '/icon.svg',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Don't cache Firebase/Firestore/Auth/analytics/cross-origin
  if (url.origin !== location.origin) return;
  if (url.pathname === '/sw.js') return;

  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    )
  );
});
