'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { WifiOff, Wifi, RefreshCw, Home, Truck, Search } from 'lucide-react';

export default function OfflinePage() {
  const [online, setOnline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOnline(navigator.onLine);

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const res = await fetch('/icons/icon-192.png', { cache: 'no-store', method: 'HEAD' });
      setOnline(res.ok);
      if (res.ok) {
        window.location.href = '/';
      }
    } catch {
      setOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4 py-12 text-ink">
      <div className="w-full max-w-lg border-2 border-ink bg-paper p-6 md:p-8 text-center shadow-lg">
        <div className="mx-auto grid size-14 place-items-center border-2 border-ink bg-ink text-paper mb-5">
          {online ? (
            <Wifi size={24} className="text-hazard" />
          ) : (
            <WifiOff size={24} className="text-hazard animate-pulse" />
          )}
        </div>

        <p className="mono text-[10px] uppercase tracking-[0.24em] text-hazard font-bold">
          {online ? 'CONNECTION DETECTED' : 'OFFLINE MODE'}
        </p>

        <h1 className="display mt-2 text-4xl md:text-5xl leading-none">
          {online ? 'YOU ARE BACK ONLINE' : 'NO INTERNET CONNECTION'}
        </h1>

        <p className="mt-4 text-sm leading-6 text-ink-80">
          {online
            ? 'Your device is reconnected. You can continue submitting requests or tracking your moves.'
            : 'You are currently disconnected. Previously visited screens are still available from your local cache, and connection will resume automatically.'}
        </p>

        {/* Action button */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={checkConnection}
            disabled={isChecking}
            className="mono inline-flex items-center gap-2 border border-ink bg-hazard px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
            {isChecking ? 'CHECKING…' : 'RETRY CONNECTION'}
          </button>
        </div>

        {/* Cached Available Screens */}
        <div className="mt-8 border-t border-ink/20 pt-6 text-left">
          <p className="mono text-[10px] text-ink-40 uppercase tracking-wider mb-3 text-center">
            CACHED OFFLINE SECTIONS
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Link
              href="/"
              className="mono flex items-center justify-center gap-2 border border-ink bg-paper-soft p-3 text-[11px] font-semibold hover:bg-ink hover:text-paper transition"
            >
              <Home size={13} />
              HOME
            </Link>
            <Link
              href="/request"
              className="mono flex items-center justify-center gap-2 border border-ink bg-paper-soft p-3 text-[11px] font-semibold hover:bg-ink hover:text-paper transition"
            >
              <Truck size={13} />
              ESTIMATOR
            </Link>
            <Link
              href="/track"
              className="mono flex items-center justify-center gap-2 border border-ink bg-paper-soft p-3 text-[11px] font-semibold hover:bg-ink hover:text-paper transition"
            >
              <Search size={13} />
              TRACKING
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
