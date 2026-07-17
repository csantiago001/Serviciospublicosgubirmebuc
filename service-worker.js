const CACHE_NAME = 'gubir-mebuc-v2'; // 👈 subí la versión para forzar limpieza en todos los dispositivos
const ARCHIVOS_CACHE = [
  './index.html',
  './manifest.json',
  './logo.jpeg',
  './fondo.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cachea cada archivo por separado: si uno falla, no tumba a los demás
      return Promise.allSettled(
        ARCHIVOS_CACHE.map((url) => cache.add(url))
      );
    })
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
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Para la página principal (navegación): intenta red primero, y si falla, usa caché
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Para el resto de archivos (imágenes, manifest, etc.): caché primero, red de respaldo
  event.respondWith(
    caches.match(event.request).then((respuestaCache) => {
      return respuestaCache || fetch(event.request).catch(() => respuestaCache);
    })
  );
});
