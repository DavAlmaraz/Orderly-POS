const CACHE_NAME = 'orderly-pos-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/manifest.json', '/icon.svg'])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Nunca almacenar en caché respuestas de API o WebSockets para evitar fugas de sesión o datos desactualizados
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io')) {
    return;
  }

  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
