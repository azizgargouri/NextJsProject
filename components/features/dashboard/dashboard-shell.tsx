'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { Button } from '@/components/ui/button';
import { useSignOut } from '@/hooks/content/auth/use-sign-out';

/**
 * Protected shell — the authenticated app layout.
 * Unauthenticated users are redirected to /login, mirroring instanct-ui's
 * Application.tsx guard. The session lives in the persisted auth store and
 * the access token is repaired silently by the Axios 401 interceptor.
 */
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);
  const signOut = useSignOut();

  useEffect(() => {
    const persistence = useAuthStore.persist;
    if (!persistence) {
      setHydrated(true);
      return;
    }
    if (persistence.hasHydrated()) setHydrated(true);
    return persistence.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace('/sign-in');
      return;
    }
    if (user?.role === 'ADMIN') {
      router.replace('/admin');
      return;
    }
  }, [hydrated, isAuthenticated, router, user?.role]);

  if (!hydrated || !isAuthenticated || user?.role === 'ADMIN') {
    return (
      <div className="mono flex min-h-dvh items-center justify-center text-[11px] text-ink-80">
        LOADING WORKSPACE…
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-40 border-b border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <p className="mono text-sm font-bold">
            <span className="mr-2 inline-block size-2.5 bg-hazard align-middle" />
            MOVE<span className="text-hazard">UP</span>
          </p>
          <div className="flex items-center gap-4">
            <p className="mono text-[10px] text-ink-80">
              {user?.name?.toUpperCase() ?? 'OPERATOR'} / {user?.role ?? 'CLIENT'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut.mutate(undefined, { onSuccess: () => router.replace('/') })}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
