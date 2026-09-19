/* Kisan Setu service worker: offline app shell, stale-while-revalidate data, Background Sync nudge. */
const VERSION = 'ks-react-v1';
const SHELL = ['/', '/index.html', '/assets/app.js', '/assets/app.css', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png',
  '/data/i18n.json', '/data/kb.json', '/data/seed.json'];
const PUBLIC_API = /^\/api\/(prices|buyers|storage|transporters)$/;

self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin') || url.pathname.startsWith('/assets/admin')) return;
  if (PUBLIC_API.test(url.pathname)) {                       // directory data: network first, last good copy when offline
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 3500);
        const res = await fetch(req, { signal: ctl.signal }); clearTimeout(timer);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (_) { return (await cache.match(req)) || new Response('{"error":"offline"}', { status: 503, headers: { 'Content-Type': 'application/json' } }); }
    })());
    return;
  }
  if (url.pathname.startsWith('/api/')) return;               // private data is never cached
  e.respondWith((async () => {                                // app shell: cache first, refresh in the background
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { net.catch(() => {}); return hit; }
    return (await net) || (req.mode === 'navigate' ? cache.match('/index.html') : new Response('', { status: 504 }));
  })());
});

self.addEventListener('sync', e => {
  if (e.tag === 'ks-outbox') e.waitUntil(self.clients.matchAll({ includeUncontrolled: true }).then(cs => cs.forEach(c => c.postMessage('sync'))));
});
