const CACHE_NAME = 'gubir-mebuc-v1';
const ARCHIVOS_CACHE = [
  './index.html',
  './manifest.json',
  './logo.jpeg',
  './fondo.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Solo cachear peticiones a tu propio dominio (GitHub Pages), no a APIs externas (Supabase, CDNs)
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then((respuestaCache) => {
        return respuestaCache || fetch(event.request);
      })
    );
  }
});