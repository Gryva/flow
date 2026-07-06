const CACHE = 'flow-v129';
const ASSETS = [
  './',
  'index.html',
  'style.css?v=129',
  'engine.js?v=129',
  'app.js?v=129',
  'js/dir-arrows.js?v=129',
  'js/youtube-api.js',
  'js/long-press.js',
  'js/track-cache.js',
  'js/context-menu.js',
  'js/playlist-store.js',
  'js/i18n.js',
  'js/local-playlist.js',
  'manifest.json',
  'icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Only handle same-origin GET requests; let YouTube API/IFrame pass through
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
