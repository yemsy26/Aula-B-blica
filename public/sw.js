const CACHE_NAME = 'verbovivo-v1.0.0';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sql-wasm.js',
  '/sql-wasm.wasm',
  '/icon-192.svg',
  '/icon-512.svg',
  '/favicon.svg',
];

// Instalación: Precachear assets críticos (incluyendo WASM de SQLite)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[PWA] Error en precache:', err))
  );
});

// Activación: Reclamar clientes inmediatamente y purgar cachés antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
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

  // 2. Recursos estáticos y WASM: Cache-First con Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // En segundo plano refrescar si hay conexión
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {
            // Modo offline normal, no hacer nada
          });
        return cachedResponse;
      }

      // Si no estaba en caché, pedir a la red y guardar copia
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
