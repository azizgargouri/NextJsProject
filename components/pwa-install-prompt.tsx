'use client';

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already running in standalone mode (installed)
    const isRunningStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(isRunningStandalone);

    if (isRunningStandalone) return;

    // Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleIos = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isAppleIos);

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosInstructions(true);
      return;
    }

    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (isStandalone || dismissed || (!deferredPrompt && !isIos)) {
    return null;
  }

  return (
    <aside
      aria-label="Install MoveUp Application"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md border-2 border-ink bg-paper p-4 shadow-xl md:left-auto md:right-6 md:w-96"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center border border-ink bg-ink text-paper">
            <Download size={18} className="text-hazard" />
          </div>
          <div>
            <p className="mono text-[10px] uppercase tracking-wider text-hazard">
              INSTALL APPLICATION
            </p>
            <h4 className="display mt-0.5 text-base text-ink">MOVEUP ON YOUR DEVICE</h4>
            <p className="mt-1 text-xs text-ink-80">
              Install the app for instant access on the road, offline mode, and push tracking.
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="grid size-8 shrink-0 place-items-center text-ink-40 hover:text-ink"
          aria-label="Dismiss install banner"
        >
          <X size={16} />
        </button>
      </div>

      {showIosInstructions ? (
        <div className="mt-3 border-t border-ink/20 pt-3 text-xs text-ink-80">
          <p className="flex items-center gap-1 font-semibold">
            Tap the <Share size={14} className="text-hazard inline" /> Share button in Safari, then
            choose &ldquo;Add to Home Screen&rdquo;.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleInstallClick}
            className="mono flex flex-1 items-center justify-center gap-2 border border-ink bg-hazard px-4 py-2.5 text-xs font-bold text-white transition hover:bg-ink hover:text-paper"
          >
            <Download size={14} />
            {isIos ? 'HOW TO INSTALL' : 'INSTALL NOW'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="mono border border-ink bg-paper px-3 py-2.5 text-xs text-ink-80 hover:bg-paper-soft"
          >
            LATER
          </button>
        </div>
      )}
    </aside>
  );
}
