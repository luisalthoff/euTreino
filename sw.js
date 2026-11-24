const CACHE_PREFIX = 'euTreino-';
const CACHE_NAME = 'euTreino-v1.8';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/supabase.js',
  'manifest.json',
  'img/add.png',
  'img/agenda0.png',
  'img/agenda1.png',
  'img/ajustes0.png',
  'img/ajustes1.png',
  'img/avulso.png',
  'img/cal.png',
  'img/clientes0.png',
  'img/clientes1.png',
  'img/day.png',
  'img/delete.png',
  'img/fechamento0.png',
  'img/fechamento1.png',
  'img/i192.png',
  'img/i512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Always fetch live data from Supabase
  if (e.request.url.includes('supabase.co')) return;

  // Network-first for app files, falling back to cache when offline
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
