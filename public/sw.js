const SHELL_CACHE = 'moveup-shell-v3';
const ASSET_CACHE = 'moveup-assets-v3';
const OFFLINE_URL = '/offline';

const APP_SHELL = [
  '/',
  '/request',
  '/track',
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(async (cache) => {
        // Use allSettled so one missing or redirected asset doesn't abort SW installation
        await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![SHELL_CACHE, ASSET_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2')
  );
}

function isRscRequest(url, request) {
  return url.searchParams.has('_rsc') || request.headers.get('RSC') === '1';
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache authenticated private API endpoints (addresses, tokens, client data)
  if (url.pathname.startsWith('/api/')) return;

  // 1. Navigation requests (full page loads)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) return offlinePage;
          return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }),
    );
    return;
  }

  // 2. Next.js App Router client navigation (RSC) requests
  if (isRscRequest(url, request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // Return empty 204 or offline trigger so Next.js router gracefully handles or falls back to hard navigation
          return new Response('', { status: 204 });
        }),
    );
    return;
  }

  // 3. Static assets: cache-first with background revalidation
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Revalidate in background if online
          fetch(request)
            .then((response) => {
              if (response.ok) {
                caches.open(ASSET_CACHE).then((cache) => cache.put(request, response));
              }
            })
            .catch(() => {});
          return cached;
        }

        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
  }
});
