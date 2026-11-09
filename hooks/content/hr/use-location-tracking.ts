'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';

const PING_INTERVAL_MS = 5 * 60 * 1000;
const INITIAL_DELAY_MS = 10_000;

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not available in this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 60_000,
    });
  });
}

/**
 * Best-effort client tracker: while the employee is checked in and this page is
 * open, post a GPS sample every five minutes. Browsers throttle background
 * timers, so a missed interval simply produces a larger gap in the history.
 */
export function useLocationTracking(active: boolean): void {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    let cancelled = false;
    let timer: number | undefined;

    async function sendPing() {
      if (cancelled) return;

      try {
        const position = await getPosition();
        if (cancelled) return;

        await api.tracking.ping({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      } catch {
        // Permission denied, GPS timeout, or an ended server session: retry on
        // the next interval while the page stays open.
      }

      if (!cancelled) {
        timer = window.setTimeout(() => void sendPing(), PING_INTERVAL_MS);
      }
    }

    timer = window.setTimeout(() => void sendPing(), INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [active]);
}
