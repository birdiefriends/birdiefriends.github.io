// BirdieFriends Service Worker — v2.0 · 2026-05-22
const CACHE = 'bf-portal-v2.0';
const SHELL = [
  '/portal.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap'
];

// Install: cache shell files, skip waiting immediately
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

// Activate: delete ALL old caches, claim clients immediately
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for portal.html (always get latest),
//        cache-first for everything else (fonts, assets)
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Never intercept Jotform API — always live data
  if (url.includes('api.jotform.com')) return;

  // Network-first for portal.html — ensures updates reach players immediately
  if (url.includes('portal.html') || url.endsWith('/')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('/portal.html'))
    );
    return;
  }

  // Cache-first for everything else (fonts, manifest)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && e.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('/portal.html'));
    })
  );
});
