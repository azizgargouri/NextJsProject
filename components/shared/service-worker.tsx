'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Registers `public/sw.js` for the whole app (production only). Each page
 * shown is saved for offline use, with the scripts and styles it loaded.
 */
export function ServiceWorker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      // Dev chunks are not content-hashed: drop a worker left by a `yarn start` test so it can't serve stale code.
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => {});
      return;
    }
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        const loaded = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((name) => name.includes('/_next/static/'));
        registration.active?.postMessage({ type: 'cache-urls', urls: [location.href, ...loaded] });
      })
      .catch(() => {
        // No offline support (private window, blocked storage): the app still works online.
      });
  }, [pathname]);

  return null;
}
