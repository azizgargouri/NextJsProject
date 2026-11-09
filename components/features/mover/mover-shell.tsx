'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Briefcase, CalendarDays, Home, Inbox, UserRound, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { useSignOut } from '@/hooks/content/auth/use-sign-out';
import { useMoverApplication, useMoverNotifications } from '@/hooks/content/mover';
import { cn } from '@/lib/utils';
import { ApplicationStatus } from './application-status';
import { OfflineBanner, RegisterMoverServiceWorker, SaveForOffline } from './mover-pwa';
import { ErrorState, LoadingState } from './mover-ui';

const NAV = [
  { href: '/mover', label: 'Home', icon: Home },
  { href: '/mover/offers', label: 'Offers', icon: Inbox },
  { href: '/mover/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/mover/availability', label: 'Calendar', icon: CalendarDays },
  { href: '/mover/earnings', label: 'Earnings', icon: Wallet },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === '/mover' ? pathname === href : pathname.startsWith(href);
}

function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const persistence = useAuthStore.persist;
    if (!persistence || persistence.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return persistence.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

function NotificationBell() {
  const pathname = usePathname();
  const { data } = useMoverNotifications();
  const unread = data?.unreadCount ?? 0;
  return (
    <Link
      href="/mover/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      aria-current={pathname === '/mover/notifications' ? 'page' : undefined}
      className="relative flex size-10 items-center justify-center hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-hazard"
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 ? (
        <span className="mono absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center bg-hazard-dark px-1 text-[9px] tracking-normal text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  );
}

function Header({ unlocked }: { unlocked: boolean }) {
  const client = useQueryClient();
  const signOut = useSignOut();
  const user = useAuthStore((state) => state.user);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-ink bg-paper print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 md:px-6">
        <Link href="/mover" className="mono shrink-0 text-sm font-bold">
          <span className="mr-2 inline-block size-2.5 bg-hazard align-middle" aria-hidden />
          MOVE<span className="text-hazard-dark">UP</span>
        </Link>

        {unlocked ? (
          <nav aria-label="Workspace" className="hidden items-center md:flex">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(pathname, href) ? 'page' : undefined}
                className={cn(
                  'mono px-3 py-2 text-[11px] hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-hazard',
                  isActive(pathname, href) && 'bg-ink text-paper hover:bg-ink',
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className="flex items-center gap-1">
          {unlocked ? (
            <>
              <NotificationBell />
              <Link
                href="/mover/profile"
                aria-label={`Profile, ${user?.name ?? 'mover'}`}
                aria-current={pathname === '/mover/profile' ? 'page' : undefined}
                className="flex size-10 items-center justify-center hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-hazard"
              >
                <UserRound className="size-5" aria-hidden />
              </Link>
            </>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            onClick={() =>
              signOut.mutate(undefined, {
                // The next account on this device must not see this mover's cached data.
                // The shell's guard then redirects to /sign-in.
                onSuccess: () => client.removeQueries({ queryKey: ['mover'] }),
              })
            }
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Workspace"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-ink bg-paper pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? 'page' : undefined}
          className={cn(
            'mono flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] tracking-normal focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-hazard',
            isActive(pathname, href) && 'bg-ink text-paper',
          )}
        >
          <Icon className="size-5" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Guards the whole workspace. The API enforces every rule on its own; this
 * shell just sends people to the right screen (M-02).
 */
export function MoverShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const { user, isAuthenticated } = useAuthStore();
  const isMover = hydrated && isAuthenticated && user?.role === 'MOVER';

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) router.replace('/sign-in');
    else if (user?.role === 'ADMIN') router.replace('/admin');
    else if (user?.role !== 'MOVER') router.replace('/dashboard');
  }, [hydrated, isAuthenticated, router, user?.role]);

  if (!isMover) return <LoadingState label="Loading workspace" />;
  return <MoverGate pathname={pathname}>{children}</MoverGate>;
}

function MoverGate({ pathname, children }: { pathname: string; children: ReactNode }) {
  const application = useMoverApplication();
  const unlocked = application.data?.canAccessDashboard === true;

  return (
    <div className="min-h-dvh bg-paper scheme-light">
      <RegisterMoverServiceWorker />
      <Header unlocked={unlocked} />
      <OfflineBanner />
      <main
        className={cn(
          'mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10 print:max-w-none print:p-0',
          unlocked && 'pb-24 md:pb-10',
        )}
      >
        {application.isPending ? (
          <LoadingState label="Checking your application" />
        ) : application.isError ? (
          <ErrorState error={application.error} onRetry={() => void application.refetch()} />
        ) : unlocked && pathname !== '/mover/application' ? (
          children
        ) : (
          <ApplicationStatus application={application.data} />
        )}
      </main>
      {unlocked ? <BottomNav /> : null}
      {unlocked ? <SaveForOffline /> : null}
    </div>
  );
}
