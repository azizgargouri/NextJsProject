/*
 * Service worker for the installable mover app. Scope is /mover, so it never
 * controls the public site or the back office.
 *
 * - Build files: cache first (their names contain a content hash).
 * - Pages: network first, then the saved copy. They hold no job data, which
 *   the app loads separately.
 * - The mover's own API data: network first, then the last saved answer, so
 *   jobs can be read with no signal. This includes client addresses and phone
 *   numbers, so the app deletes this cache at sign-out (see mover-pwa.tsx), and
 *   a 401 or 403 removes the saved answer. Photos and documents are never saved.
 * - POST requests pass straight through.
 */
const VERSION = 'v2';
const STATIC_CACHE = `moveup-mover-static-${VERSION}`;
const PAGE_CACHE = `moveup-mover-pages-${VERSION}`;
const DATA_CACHE = `moveup-mover-data-${VERSION}`;
const OFFLINE_URL = '/mover-offline.html';
const MAX_STATIC_ENTRIES = 400;
const APP_ROUTES = [
  '/mover',
  '/mover/offers',
  '/mover/jobs',
  '/mover/availability',
  '/mover/earnings',
  '/mover/profile',
  '/mover/notifications',
];

/** Saves a page and the build files it needs, so it can open with no connection. */
async function savePage(url) {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) return;
  const html = await response.clone().text();
  const pages = await caches.open(PAGE_CACHE);
  await pages.put(url, response);

  const assets = new Set(html.match(/\/_next\/static\/[^"'\\\s<>]+/g) ?? []);
  const files = await caches.open(STATIC_CACHE);
  await Promise.allSettled(
    [...assets].map(async (asset) => {
      if (!(await files.match(asset))) await files.add(asset);
    }),
  );
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const files = await caches.open(STATIC_CACHE);
      await files.addAll([OFFLINE_URL, '/icons/mover-192.png', '/icons/mover-512.png']);
      // A page that fails to save must not stop the app from installing.
      await Promise.allSettled(APP_ROUTES.map(savePage));
    })(),
  );
});

self.addEventListener('activate', (event) => {
  const current = [STATIC_CACHE, PAGE_CACHE, DATA_CACHE];
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('moveup-mover-') && !current.includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.origin !== self.location.origin || event.data?.type !== 'SAVE_PAGES') return;
  const urls = event.data.urls.filter((url) => /^\/mover\/[\w/-]+$/.test(url));
  event.waitUntil(Promise.allSettled(urls.map(savePage)));
});

/** The browser gets the response straight away; the copy is saved in the background. */
function saveInBackground(event, cacheName, request, response, afterSave) {
  const copy = response.clone();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      await cache.put(request, copy);
      await afterSave?.(cache);
    })(),
  );
}

async function trimStaticFiles(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_STATIC_ENTRIES) await cache.delete(keys[0]);
}

async function cacheFirst(event) {
  const { request } = event;
  const cached = await caches.match(request, { cacheName: STATIC_CACHE });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) saveInBackground(event, STATIC_CACHE, request, response, trimStaticFiles);
  return response;
}

async function pageWithFallback(event) {
  const { request } = event;
  try {
    const response = await fetch(request);
    if (response.ok) saveInBackground(event, PAGE_CACHE, request, response);
    return response;
  } catch {
    const pages = await caches.open(PAGE_CACHE);
    const saved = await pages.match(request, { ignoreSearch: true });
    return saved ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
  }
}

async function dataWithFallback(event) {
  const { request } = event;
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) saveInBackground(event, DATA_CACHE, request, response);
    else if (response.status === 401 || response.status === 403) await cache.delete(request);
    return response;
  } catch {
    return (await cache.match(request)) ?? Response.error();
  }
}

function isMoverData(pathname) {
  return pathname.startsWith('/api/mover/') || /^\/api\/moves\/[^/]+\/messages$/.test(pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') event.respondWith(pageWithFallback(event));
  else if (url.pathname.startsWith('/_next/static/')) event.respondWith(cacheFirst(event));
  else if (isMoverData(url.pathname)) event.respondWith(dataWithFallback(event));
});
