'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/hooks/stores/auth-store';

/**
 * Registers /sw.js (course workshop part C, "RegisterSW"). Production only by default:
 * in `next dev` a caching worker would serve stale bundles. Set
 * NEXT_PUBLIC_ENABLE_SW=true to test offline mode locally.
 * On sign-out it asks the worker to delete cached private pages (shared-device privacy).
 */
export function RegisterSW() {
  useEffect(() => {
    const enabled =
      process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SW === 'true';
    if (!enabled || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.error('[sw] registration failed', error);
    });

    return useAuthStore.subscribe((state, previous) => {
      if (previous.isAuthenticated && !state.isAuthenticated) {
        navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_PRIVATE_CACHE' });
      }
    });
  }, []);

  return null;
}
