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

  useEffect(() => {
    if (useAuthStore.persist?.hasHydrated?.()) {
      setHydrated(true);
      return;
    }
    const unsubscribe = useAuthStore.persist?.onFinishHydration?.(() => setHydrated(true));
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
    if (adminOnly && user?.role !== 'ADMIN') {
      if (user?.role === 'MOVER') {
        router.replace('/me');
      } else {
        router.replace('/request');
      }
      return;
    }
  }, [hydrated, isAuthenticated, adminOnly, user?.role, router]);

  if (!hydrated || !isAuthenticated || (adminOnly && user?.role !== 'ADMIN')) {
    return (
      <div className="mono flex min-h-dvh flex-col items-center justify-center gap-2 text-[11px] text-ink-80">
        <span className="size-2 bg-hazard animate-ping" />
        <span>LOADING WORKSPACE…</span>
      </div>
    );
  }

  const navItems = user?.role === 'ADMIN' ? HR_NAV : SELF_NAV;

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-40 border-b border-ink bg-paper/95 backdrop-blur">
        {/* Main top bar */}
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="mono text-sm font-bold flex items-center">
              <span className="mr-2 inline-block size-2.5 bg-hazard" />
              MOVE<span className="text-hazard">UP</span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'mono border-b-2 border-hazard pb-1 text-[11px] font-bold text-ink'
                        : 'mono border-b-2 border-transparent pb-1 text-[11px] text-ink-40 transition-colors hover:text-ink'
                    }
                  >
                    {item.label.toUpperCase()}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User profile & actions */}
          <div className="flex items-center gap-3 md:gap-4">
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

        {/* Mobile horizontal scrollable navigation strip */}
        <div className="flex md:hidden overflow-x-auto no-scrollbar border-t border-ink/15 px-4 py-2 gap-4 bg-paper-soft">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'mono whitespace-nowrap border-b-2 border-hazard pb-0.5 text-[11px] font-bold text-ink'
                    : 'mono whitespace-nowrap border-b-2 border-transparent pb-0.5 text-[11px] text-ink-40'
                }
              >
                {item.label.toUpperCase()}
              </Link>
            );
          })}
        </div>
      </header>
      {children}
    </div>
  );
}
