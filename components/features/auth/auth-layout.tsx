'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { AuthPanel } from '@/components/features/auth/auth-panel';

/**
 * Auth layout shell: split screen — telemetry panel (desktop) + form column.
 * Authenticated visitors are redirected away from auth pages
 * (replicates instanct-ui `Application.tsx` route-guard behaviour).
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!useAuthStore.persist.hasHydrated()) return;
    if (isAuthenticated) {
      router.replace('/');
      return;
    }
    setChecked(true);
  }, [isAuthenticated, router]);

  useEffect(() => {
    // Persisted state may still be resolving on first paint.
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      if (useAuthStore.getState().isAuthenticated) {
        router.replace('/');
      } else {
        setChecked(true);
      }
    });
    return unsub;
  }, [router]);

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
