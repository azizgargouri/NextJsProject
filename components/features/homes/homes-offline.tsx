'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Bar shown on the homes pages while offline (their data is saved by public/sw.js). */
export function HomesOffline() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  if (online) return null;
  return (
    <p role="status" className="mono bg-ink px-4 py-2 text-center text-[10px] text-paper">
      <span aria-hidden className="mr-2 inline-block size-2 bg-hazard align-middle" />
      OFFLINE — SHOWING YOUR LAST SAVED COPY. CHANGES WAIT UNTIL YOU RECONNECT.
    </p>
  );
}
