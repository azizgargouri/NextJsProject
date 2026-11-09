'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { Button } from '@/components/ui/button';
import { useSignOut } from '@/hooks/content/auth/use-sign-out';
import { useOnlineStatus } from '@/hooks/use-online-status';
import {
  WorkspaceLinkList,
  workspaceHome,
  workspaceLinks,
} from '@/components/features/workspace/workspace-links';

/**
 * Protected shell — the authenticated app layout.
 * Mobile-first responsive header with dedicated scrollable mobile navigation strip.
 */
export function DashboardLayout({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);
  const signOut = useSignOut();
  const online = useOnlineStatus();

  useEffect(() => {
    const persistence = useAuthStore.persist;
    if (!persistence) {
      setHydrated(true);
      return;
    }
    if (persistence.hasHydrated?.()) {
      setHydrated(true);
      return;
    }
    const unsubscribe = persistence.onFinishHydration?.(() => setHydrated(true));
    const timer = window.setTimeout(() => setHydrated(true), 60);

    return () => {
      unsubscribe?.();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace('/sign-in');
      return;
    }
    // Movers work in their own workspace (/mover); the HR pages (/me, contracts) stay reachable.
    if (user?.role === 'MOVER' && pathname === '/dashboard') {
      router.replace('/mover');
      return;
    }
    if (adminOnly && user?.role !== 'ADMIN') {
      if (user?.role === 'MOVER') {
        router.replace('/mover');
      } else {
        router.replace('/request');
      }
      return;
    }
  }, [hydrated, isAuthenticated, adminOnly, user?.role, router, pathname]);

  if (!hydrated || !isAuthenticated || (adminOnly && user?.role !== 'ADMIN')) {
    return (
      <div className="mono flex min-h-dvh flex-col items-center justify-center gap-2 text-[11px] text-ink-80">
        <span className="size-2 bg-hazard animate-ping" />
        <span>LOADING WORKSPACE…</span>
      </div>
    );
  }

  const navItems = workspaceLinks(user?.role);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-40 border-b border-ink bg-paper/95 backdrop-blur">
        {/* Main top bar */}
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-6">
            <Link
              href={workspaceHome(user?.role)}
              className="mono flex shrink-0 items-center text-sm font-bold"
            >
              <span className="mr-2 inline-block size-2.5 bg-hazard" />
              MOVE<span className="text-hazard">UP</span>
            </Link>

            {/* Desktop navigation: every module of the signed-in role, in one header */}
            <nav aria-label="Workspace" className="hidden items-center gap-5 lg:flex">
              <WorkspaceLinkList links={navItems} variant="inline" />
            </nav>
          </div>

          {/* User profile & actions */}
          <div className="flex items-center gap-3 md:gap-4">
            <p
              className="mono hidden items-center gap-1.5 text-[10px] text-ink-80 sm:flex"
              role="status"
            >
              <span
                className={online ? 'inline-block size-2 bg-ink' : 'inline-block size-2 bg-hazard'}
                aria-hidden
              />
              {online ? 'ONLINE' : 'OFFLINE'}
            </p>
            <p className="mono text-[10px] text-ink-80 truncate max-w-[130px] sm:max-w-none">
              {user?.name?.toUpperCase() ?? 'OPERATOR'} / {user?.role ?? 'CLIENT'}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-[10px]"
              onClick={() => signOut.mutate(undefined, { onSuccess: () => router.replace('/') })}
            >
              Sign out
            </Button>
          </div>
        </div>

        {/* Mobile and tablet: the same links as a scrollable strip */}
        <nav
          aria-label="Workspace"
          className="no-scrollbar flex gap-4 overflow-x-auto border-t border-ink/15 bg-paper-soft px-4 py-2 lg:hidden"
        >
          <WorkspaceLinkList links={navItems} variant="strip" />
        </nav>
      </header>
      {children}
    </div>
  );
}
