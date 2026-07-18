const CACHE_NAME = 'gubir-mebuc-v3'; // 👈 subí versión para forzar limpieza total en todos los dispositivos
const ARCHIVOS_CACHE = [
  './index.html',
  './manifest.json',
  './logo.jpeg',
  './icons/icon-192.png',
  './icons/icon-512.png'
  // 👈 fondo.jpg ya NO se precarga aquí: así nunca queda "congelado" en caché,
  //    siempre se revisa contra el servidor en tiempo real (ver estrategia abajo)
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
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
  if (event.request.method !== 'GET') return;

  // Navegación (la página principal): red primero, caché de respaldo
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // La imagen de fondo SIEMPRE se pide en vivo al servidor (nunca desde caché vieja)
  if (event.request.url.includes('fondo.jpg')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // El resto de archivos estáticos: caché primero, red de respaldo
  event.respondWith(
    caches.match(event.request).then((respuestaCache) => {
      return respuestaCache || fetch(event.request).catch(() => respuestaCache);
    })
  );
});
