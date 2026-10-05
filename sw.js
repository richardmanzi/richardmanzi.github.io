const CACHE_NAME = 'richard-portfolio-v5';
const HOME_URL = new URL('./', self.registration.scope).href;
const INDEX_URL = new URL('index.html', HOME_URL).href;
const OFFLINE_URL = new URL('offline.html', HOME_URL).href;
const NETWORK_TIMEOUT_MS = 2500;
const APP_SHELL = [
  HOME_URL,
  INDEX_URL,
  OFFLINE_URL,
  new URL('profile.webp', HOME_URL).href,
  new URL('glass.css', HOME_URL).href,
  new URL('manifest.json', HOME_URL).href,
  new URL('testimonials.json', HOME_URL).href,
  new URL('app-icon-192.png', HOME_URL).href,
  new URL('app-icon-512.png', HOME_URL).href
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('richard-portfolio-') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith((async () => {
      const isHome = url.pathname === new URL(HOME_URL).pathname || url.pathname === new URL(INDEX_URL).pathname;
      const cached = await caches.match(request) ||
        (isHome ? await caches.match(HOME_URL) || await caches.match(INDEX_URL) : null) ||
        await caches.match(OFFLINE_URL);
      const controller = new AbortController();
      let timeoutId;
      const network = fetch(request, { signal: controller.signal, cache: 'no-cache' })
        .then(async response => {
          if (response.ok && response.type === 'basic' && isHome) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(HOME_URL, response.clone());
            await cache.put(INDEX_URL, response.clone());
          }
          return response.status >= 500 ? null : response;
        })
        .catch(() => null);
      const timeout = new Promise(resolve => {
        timeoutId = setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS);
      });

      const response = await Promise.race([network, timeout]);
      clearTimeout(timeoutId);
      if (response) return response;
      controller.abort();
      return cached || new Response('Portfolio unavailable offline. Reconnect and visit the portfolio once to save it on this device.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    return cached || fetch(request);
  })());
});
