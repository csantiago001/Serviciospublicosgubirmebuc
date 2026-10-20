// GUBIR MEBUC · Service Worker
// v4: añade css/tema.css y js/importador.js. El código (HTML, JS, CSS, JSON)
// se pide primero a la red para que una corrección publicada llegue de
// inmediato; la caché solo se usa sin conexión. Las imágenes van caché-primero.
const CACHE_NAME = 'gubir-mebuc-v4';
const ARCHIVOS_CACHE = [
  './index.html',
  './manifest.json',
  './css/tema.css',
  './js/importador.js',
  './logo.jpeg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(ARCHIVOS_CACHE.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

function redPrimero(request) {
  return fetch(request)
    .then((resp) => {
      if (resp && resp.ok) {
        const copia = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, copia)).catch(() => {});
      }
      return resp;
    })
    .catch(() => caches.match(request).then((r) => r || caches.match('./index.html')));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req.url.startsWith(self.location.origin) || req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  // El fondo siempre en vivo
  if (url.pathname.endsWith('fondo.jpg')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
  if (/\.(js|css|json|html)$/.test(url.pathname)) {
    event.respondWith(redPrimero(req));
    return;
  }
  event.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
