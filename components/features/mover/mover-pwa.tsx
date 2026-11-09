'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';
import { useMoverJobs, useMoverOffers } from '@/hooks/content/mover';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { api } from '@/lib/api';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const CACHE_OWNER_KEY = 'moveup-mover-cache-owner';
const RELOAD_GUARD_KEY = 'moveup-mover-sw-reloaded';
/** How long a freshly activated worker gets to claim this page. */
const CLAIM_WAIT_MS = 2000;

/** Client addresses and phone numbers must not outlive the session on this device. */
async function clearSavedJobData(): Promise<void> {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(
    keys.filter((key) => key.startsWith('moveup-mover-data-')).map((key) => caches.delete(key)),
  );
}

function readOwner(): string | null {
  try {
    return localStorage.getItem(CACHE_OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(owner: string | null): void {
  try {
    if (owner) localStorage.setItem(CACHE_OWNER_KEY, owner);
    else localStorage.removeItem(CACHE_OWNER_KEY);
  } catch {
    // Storage is blocked: the sign-out clear above still applies.
  }
}

function workerIsInControl(): boolean {
  return navigator.serviceWorker?.controller?.scriptURL.endsWith('/mover-sw.js') ?? false;
}

function subscribeToController(onChange: () => void) {
  navigator.serviceWorker?.addEventListener('controllerchange', onChange);
  return () => navigator.serviceWorker?.removeEventListener('controllerchange', onChange);
}

function useWorkerInControl(): boolean {
  return useSyncExternalStore(subscribeToController, workerIsInControl, () => false);
}

/**
 * Not navigator.serviceWorker.ready: that follows the URL this document started at,
 * so it never resolves when the app arrived from outside /mover, the case handled below.
 */
function untilActive(registration: ServiceWorkerRegistration): Promise<void> {
  const worker = registration.installing ?? registration.waiting;
  if (!worker) return Promise.resolve();
  return new Promise((resolve) => {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated' || worker.state === 'redundant') resolve();
    });
  });
}

/**
 * A worker can only take over a document that was created inside its scope. If the
 * app arrived here from outside /mover without a page load, nothing would be saved
 * for offline use, so that one case reloads, at most once per tab session.
 */
async function ensureWorkerInControl(registration: ServiceWorkerRegistration): Promise<void> {
  await untilActive(registration);
  if (workerIsInControl()) {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, CLAIM_WAIT_MS));
  if (workerIsInControl() || !navigator.onLine) return;
  if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return;
  sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
  window.location.reload();
}

/** Installs the worker (production only: dev build files are not hashed). */
export function RegisterMoverServiceWorker() {
  useEffect(() => {
    if (!IS_PRODUCTION || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/mover-sw.js', { scope: '/mover' })
      .then(ensureWorkerInControl)
      .catch((error) => {
        console.error('[mover-sw] registration failed', error);
      });
  }, []);

  useEffect(() => {
    // Another mover signed in on this device: nothing of the last one may remain.
    const userId = useAuthStore.getState().user?.id ?? null;
    if (readOwner() !== userId) void clearSavedJobData();
    writeOwner(userId);

    return useAuthStore.subscribe((state, previous) => {
      if (state.user?.id === previous.user?.id) return;
      void clearSavedJobData();
      writeOwner(state.user?.id ?? null);
    });
  }, []);

  return null;
}

/** The calendar's current month, matching the request its screen makes. */
function currentMonthRange(): { from: string; to: string } {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  const iso = (day: number) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
  return { from: iso(1), to: iso(new Date(Date.UTC(year, month + 1, 0)).getUTCDate()) };
}

/**
 * Once the worker is in control, requests everything each main screen shows, so
 * it opens offline even if the mover never visited it. Chat is left out on purpose:
 * reading a conversation marks its messages as read.
 */
export function SaveForOffline() {
  const client = useQueryClient();
  const inControl = useWorkerInControl();
  const jobs = useMoverJobs();
  const offers = useMoverOffers();
  const jobIds = jobs.data?.active.map((job) => job.id).join(',') ?? '';
  const offerIds = offers.data?.offers.map((offer) => offer.id).join(',') ?? '';

  useEffect(() => {
    if (!inControl || !navigator.onLine) return;
    const { from, to } = currentMonthRange();
    const screens: { queryKey: string[]; queryFn: () => Promise<unknown> }[] = [
      { queryKey: ['mover', 'application'], queryFn: api.mover.application },
      { queryKey: ['mover', 'dashboard'], queryFn: api.mover.dashboard },
      { queryKey: ['mover', 'offers'], queryFn: api.mover.offers },
      { queryKey: ['mover', 'jobs'], queryFn: api.mover.jobs },
      { queryKey: ['mover', 'earnings'], queryFn: api.mover.earnings },
      { queryKey: ['mover', 'profile'], queryFn: api.mover.profile },
      { queryKey: ['mover', 'notifications'], queryFn: api.mover.notifications },
      {
        queryKey: ['mover', 'availability', from, to],
        queryFn: () => api.mover.availability(from, to),
      },
    ];
    for (const screen of screens) void client.prefetchQuery({ ...screen, staleTime: 0 });
  }, [client, inControl]);

  useEffect(() => {
    if (!inControl || !navigator.onLine) return;
    const activeJobs = jobIds ? jobIds.split(',') : [];
    const openOffers = offerIds ? offerIds.split(',') : [];
    for (const id of activeJobs) {
      void client.prefetchQuery({
        queryKey: ['mover', 'jobs', id],
        queryFn: () => api.mover.job(id),
        staleTime: 0,
      });
    }
    for (const id of openOffers) {
      void client.prefetchQuery({
        queryKey: ['mover', 'offers', id],
        queryFn: () => api.mover.offer(id),
        staleTime: 0,
      });
    }
    const urls = [
      ...activeJobs.map((id) => `/mover/jobs/${id}`),
      ...openOffers.map((id) => `/mover/offers/${id}`),
    ];
    if (urls.length > 0) {
      navigator.serviceWorker.controller?.postMessage({ type: 'SAVE_PAGES', urls });
    }
  }, [client, inControl, jobIds, offerIds]);

  return null;
}

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Writes wait for the connection, and only survive while the page stays open. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div role="status" className="border-b border-ink bg-ink text-paper">
      <p className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm md:px-6">
        <WifiOff className="size-4 shrink-0" aria-hidden />
        You are offline, showing your last saved data. Keep this page open: your updates are sent
        when you reconnect.
      </p>
    </div>
  );
}
