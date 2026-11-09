'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { PwaInstallPrompt } from './pwa-install-prompt';

export function PwaRegister() {
  const [isOnline, setIsOnline] = useState(true);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = window.setTimeout(() => setShowRestored(false), 3500);
      return () => window.clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Reliable Service Worker registration (handles post-load hydration)
    if ('serviceWorker' in navigator) {
      const register = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          // Check for worker updates
          await registration.update();
        } catch {
          // Graceful fallback: the app still runs in standard browser mode
        }
      };

      if (document.readyState === 'complete') {
        void register();
      } else {
        window.addEventListener('load', register);
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div
          role="status"
          aria-live="assertive"
          className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 border-b border-ink bg-hazard px-4 py-2.5 text-center text-xs font-bold text-white shadow-md mono"
        >
          <WifiOff size={15} className="animate-pulse" />
          <span>OFFLINE MODE — BROWSING CACHED DATA. CHANGES WILL SYNC ON RECONNECT.</span>
        </div>
      )}

      {/* Online Restored Toast */}
      {showRestored && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 border-b border-ink bg-ink px-4 py-2 text-center text-xs font-bold text-paper shadow-md mono transition-all"
        >
          <Wifi size={15} className="text-hazard" />
          <span>CONNECTION RESTORED — BACK ONLINE</span>
        </div>
      )}

      {/* PWA Install Banner */}
      <PwaInstallPrompt />
    </>
  );
}
