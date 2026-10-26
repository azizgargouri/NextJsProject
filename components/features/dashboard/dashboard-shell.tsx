'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { Button } from '@/components/ui/button';
import { useSignOut } from '@/hooks/content/auth/use-sign-out';

const HR_NAV = [
  { href: '/dashboard', label: 'Workspace' },
  { href: '/employees', label: 'Employees' },
  { href: '/attendance', label: 'Attendance' },
  { href: '/leave', label: 'Leave' },
];

const SELF_NAV = [{ href: '/me', label: 'My workspace' }];

/**
 * Protected shell — the authenticated app layout.
 * Unauthenticated users are redirected to /sign-in, mirroring instanct-ui's
 * Application.tsx guard. The session lives in the persisted auth store and
 * the access token is repaired silently by the Axios 401 interceptor.
 *
 * `adminOnly` pages (the RH surface) additionally bounce non-admin sessions
 * to /me, replacing the local module's role guard.
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
  const [checked, setChecked] = useState(false);
  const signOut = useSignOut();

  useEffect(() => {
    if (!useAuthStore.persist.hasHydrated()) return;
    if (!isAuthenticated) {
      router.replace('/sign-in');
      return;
    }
    if (adminOnly && user?.role !== 'ADMIN') {
      router.replace('/me');
      return;
    }
    setChecked(true);
  }, [isAuthenticated, adminOnly, user?.role, router]);

  if (!checked) {
    return (
      <div className="mono flex min-h-dvh items-center justify-center text-[11px] text-ink-80">
        LOADING WORKSPACE…
      </div>
    );
  }

  const navItems = user?.role === 'ADMIN' ? HR_NAV : SELF_NAV;

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-40 border-b border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/dashboard" className="mono text-sm font-bold">
              <span className="mr-2 inline-block size-2.5 bg-hazard align-middle" />
              MOVE<span className="text-hazard">UP</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'mono border-b-2 border-hazard pb-1 text-[10px] text-ink'
                        : 'mono border-b-2 border-transparent pb-1 text-[10px] text-ink-40 transition-colors hover:text-ink'
                    }
                  >
                    {item.label.toUpperCase()}
                  </Link>
                );
              })}
            </nav>
          </div>
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
