/* MoveUp — offline support for the installable app (scope /).
 *
 * - /_next/static/*                 cache first (file names are content-hashed)
 * - pages + RSC payloads            network first, saved copy when offline
 *                                   (page HTML holds no user data: it is rendered in the browser)
 * - GET /api/homes*                 network first, saved copy when offline,
 *                                   one cache per signed-in user (JWT `sub`)
 * - every other /api/* call         network only (auth, admin: never stored on the device)
 * Writes (POST/PATCH/DELETE) are never cached: they need the network.
 */

const VERSION = 'v1';
const STATIC = `moveup-static-${VERSION}`;
const PAGES = `moveup-pages-${VERSION}`;
const HOMES_API = `moveup-homes-api-${VERSION}-`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // First version was registered for /dashboard/homes only: hand over to the / registration.
      if (new URL(self.registration.scope).pathname !== '/') return self.registration.unregister();
      const keep = (name) => name === STATIC || name === PAGES || name.startsWith(HOMES_API);
      for (const name of await caches.keys()) {
        if (/^(homes|moveup)-/.test(name) && !keep(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

// The page sends what it already loaded before this worker took control
// (first visit), plus every page it shows, so each one opens offline.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache-urls') return;
  event.waitUntil(
    Promise.all(
      event.data.urls.map(async (href) => {
        const url = new URL(href, self.location.origin);
        if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
        const cache = await caches.open(url.pathname.startsWith('/_next/static/') ? STATIC : PAGES);
        // A saved page is refreshed by its next full load (pageNetworkFirst), not here.
        if (await cache.match(url, { ignoreVary: true })) return;
        try {
          const response = await fetch(url, { credentials: 'same-origin' });
          if (response.ok && !response.redirected) await cache.put(url, response);
        } catch {
          // offline right now: the next visit will try again
        }
      }),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/homes')) {
    const userId = userIdOf(request);
    if (userId) event.respondWith(homesApiNetworkFirst(event, userId));
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === 'navigate' || request.headers.get('RSC') === '1') {
    event.respondWith(pageNetworkFirst(event));
  }
  // Anything else (images, manifest, icons) goes straight to the network.
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // ponytail: static cache only grows (old hashed chunks stay after a deploy); bump VERSION to reset it.
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function pageNetworkFirst(event) {
  const { request } = event;
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected) {
      event.waitUntil(cache.put(request, response.clone()));
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    // RSC fetch (client-side navigation) miss: fail like the network did, so
    // Next.js falls back to a full page load, which this worker answers from cache.
    if (request.mode !== 'navigate') return Response.error();
    return offlinePage();
  }
}

async function homesApiNetworkFirst(event, userId) {
  const { request } = event;
  const cacheName = HOMES_API + userId;
  // Another account on this browser: drop the previous account's saved houses.
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(HOMES_API) && name !== cacheName)
            .map((name) => caches.delete(name)),
        ),
      ),
  );
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    // 404 is a real answer here ("no layout plan yet"); 401/403/5xx are not saved.
    if (response.ok || response.status === 404) {
      event.waitUntil(cache.put(request, response.clone()));
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreVary: true });
    return cached ?? Response.error();
  }
}

/** Reads `sub` from the Bearer JWT. No verification: it only picks the cache, the server still checks the token. */
function userIdOf(request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).sub || null;
  } catch {
    return null;
  }
}

function offlinePage() {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — MoveUp</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f2f1ec;color:#101010;font:14px/1.5 ui-monospace,Menlo,monospace;padding:16px}main{max-width:28rem;border:1px solid #101010;padding:24px}h1{margin:0 0 8px;font-size:20px}b{color:#e61919}a{color:inherit}</style></head>
<body><main><h1><b>■</b> OFFLINE</h1><p>This page was not saved for offline use yet. Open it once while you are online and it will be available next time.</p><p><a href="/dashboard">Workspace</a> · <a href="/dashboard/homes">My houses</a></p></main></body></html>`,
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
