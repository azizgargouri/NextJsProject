/* MoveUp service worker — course ch.1 / ch.3 / workshop part C.
 * Lifecycle: install (precache the app shell) → activate (delete old caches) → fetch (strategies).
 * Bump VERSION on every deploy that changes the shell: the new worker then replaces the old one.
 */
const VERSION = 'v2';
const SHELL_CACHE = `moveup-shell-${VERSION}`;
const PAGE_CACHE = `moveup-pages-${VERSION}`;
const DATA_CACHE = `moveup-data-${VERSION}`;
const OFFLINE_URL = '/offline';

const SHELL_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = [SHELL_CACHE, PAGE_CACHE, DATA_CACHE];
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('moveup-') && !keep.includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/* ---------- strategies ---------- */

// Cache First — immutable build assets & icons: instant, the network only on a miss.
async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

// Network First — pages: always fresh when online, last copy (or /offline) when not.
async function networkFirst(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

// Stale-While-Revalidate — public, non-critical data: answer from cache, refresh in background.
async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  event.waitUntil(refresh.then(() => undefined));
  return cached || refresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network Only: mutations, other origins, auth, admin, AI streams and private API data.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) {
    if (/^\/api\/movers\/[^/]+\/reviews$/.test(url.pathname)) {
      event.respondWith(staleWhileRevalidate(request, event));
    }
    return;
  }
  // Never cache the back office or React Server Component payloads.
  if (url.pathname.startsWith('/admin') || request.headers.get('RSC') === '1') return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  }
});

// Privacy: the app asks to wipe cached private pages when the user signs out.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_PRIVATE_CACHE') {
    event.waitUntil(caches.delete(PAGE_CACHE));
  }
});
