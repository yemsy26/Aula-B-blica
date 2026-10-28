const CACHE_NAME = 'verbovivo-v1.0.11';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sql-wasm.js',
  '/sql-wasm.wasm',
  // Runtime del cerebro on-device: sin este archivo el GGUF no puede
  // ejecutarse cuando la PWA se abre sin red.
  '/wllama/wllama.wasm',
  '/icon-192.svg',
  '/icon-512.svg',
  '/favicon.svg',
];

// Instalación: Precachear assets y forzar activación inmediata
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => console.warn('[PWA] Error en precache:', err))
  );
});

// Activación: Purgar inmediatamente TODOS los cachés antiguos y reclamar clientes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[PWA] Purgando caché antiguo:', name);
              return caches.delete(name);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Intercepción de peticiones de red
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Solo peticiones GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // En entorno localhost nunca interceptar para no interferir con recarga rápida de Vite
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return;
  }

  // 1. Navegación HTML: Network-First con fallback a index.html en caché (100% Offline)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          return cached || (await caches.match('/'));
        })
    );
    return;
  }

  // 2. Recursos: Network-first cuando hay conexión para recibir siempre los estilos más recientes
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});
