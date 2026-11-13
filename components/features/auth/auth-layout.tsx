'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { AuthPanel } from '@/components/features/auth/auth-panel';

/**
 * Auth layout shell: split screen — telemetry panel (desktop) + form column.
 *
 * Auth pages stay reachable even when a persisted session exists. Redirecting
 * authenticated visitors away made an expired/revoked session impossible to
 * replace: `/dashboard` bounced to `/sign-in`, and `/sign-in` bounced to `/`.
 * Protected pages are guarded by `DashboardLayout`; this shell only waits for
 * the persisted auth store to hydrate.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setChecked(true);
      return;
    }

    // Persisted state may still be resolving on first paint.
    return useAuthStore.persist.onFinishHydration(() => setChecked(true));
  }, []);

  if (!checked) {
    return (
      <div className="mono flex min-h-dvh items-center justify-center gap-2 text-[11px] text-ink-80">
        CHECKING SESSION…
      </div>
    );
  }

  return (
    <main className="grid min-h-dvh w-full max-w-full grid-cols-1 overflow-x-hidden lg:grid-cols-2">
      <AuthPanel />
      {children}
    </main>
  );
}
