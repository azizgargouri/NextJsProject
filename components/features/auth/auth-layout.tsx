'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { AuthPanel } from '@/components/features/auth/auth-panel';

/**
 * Auth layout shell: split screen — telemetry panel (desktop) + form column.
 * Always renders the form immediately without blocking on session checks.
 * If the user is already authenticated, displays an informative header with
 * quick links to continue to their workspace or switch account.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="grid min-h-dvh w-full max-w-full grid-cols-1 overflow-x-hidden lg:grid-cols-2">
      <AuthPanel />
      <div className="flex flex-col justify-between">
        {mounted && isAuthenticated && user && (
          <div className="border-b border-ink bg-hazard/10 px-6 py-3 mono text-xs">
            <div className="mx-auto flex max-w-md flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[9px] text-ink-40 font-bold uppercase tracking-wider">
                  ALREADY LOGGED IN
                </p>
                <p className="font-semibold text-ink text-xs truncate max-w-[200px] sm:max-w-none">
                  {user.name} ({user.email}) · <span className="text-hazard font-bold">{user.role}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={
                    user.role === 'ADMIN' ? '/dashboard' : user.role === 'MOVER' ? '/me' : '/request'
                  }
                  className="mono border border-ink bg-ink px-3 py-1 text-[10px] font-bold text-paper hover:bg-hazard hover:text-white transition"
                >
                  CONTINUE &gt;&gt;
                </Link>
                <button
                  type="button"
                  onClick={() => useAuthStore.getState().logout()}
                  className="mono text-[10px] text-ink-40 hover:text-hazard underline"
                >
                  SIGN OUT
                </button>
              </div>
            </div>
          </div>
        )}
        {children}
      </div>
    </main>
  );
}
