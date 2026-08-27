const CACHE = 'scarlett-v3';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['./']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => {
      // Tell all open tabs there's an update
      self.clients.matchAll({includeUncontrolled:true, type:'window'}).then(clients => {
        clients.forEach(c => c.postMessage({type:'sw-updated'}));
      });
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(self.location.origin)) return;

  const url = new URL(e.request.url);
  const isHtml = url.pathname === '/' || url.pathname.endsWith('.html') || url.pathname.endsWith('/index.html');

  if (isHtml) {
    // Network-first for HTML — always get latest version
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const toCache = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, toCache));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // Cache-first for other assets
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(res => {
          if (res.ok && res.status < 400) {
            const toCache = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, toCache));
          }
          return res;
        }).catch(() => cached || new Response('Offline', {status: 503}));
        return cached || fetchPromise;
      })
    );
  }
});

self.addEventListener('message', e => {
  if (e.data === 'warmup') fetch('/?action=ping').catch(() => {});
});