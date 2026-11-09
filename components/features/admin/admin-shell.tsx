'use client';

/**
 * THESIS: A precise operations desk; it rejects the public site's campaign-like composition.
 * OWN-WORLD: Neutral semantic surfaces, one blue accent, Verdana, compact controls, low-radius borders.
 * STORY: Staff verify system state, navigate operational modules, and act on real records.
 * FIRST VIEWPORT: 256px navigation rail, quiet 64px header, page context, then a dense working surface.
 * FORM: Fixed-viewport responsive application shell prescribed by the supplied back-office architecture.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { useSignOut } from '@/hooks/content/auth/use-sign-out';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminI18nProvider, useAdminI18n } from '@/lib/i18n/admin';
import { AdminShellProvider, useAdminShell } from './shell/admin-shell-context';
import { AdminSidebar } from './shell/admin-sidebar';
import { AdminHeader } from './shell/admin-header';
import { AdminPageHeader } from './shell/admin-page-header';

const SIDEBAR_COOKIE = 'moveup_admin_sidebar';

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminI18nProvider>
      <AdminShellGate>{children}</AdminShellGate>
    </AdminI18nProvider>
  );
}

function AdminShellGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persistence = useAuthStore.persist;
    if (!persistence) {
      setHydrated(true);
      return;
    }
    if (persistence.hasHydrated()) setHydrated(true);
    return persistence.onFinishHydration(() => setHydrated(true));
  }, []);

  const session = useQuery({
    queryKey: ['auth', 'me', 'admin-shell'],
    queryFn: api.auth.me,
    enabled: hydrated && isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace('/sign-in');
      return;
    }
    if (session.data && session.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [hydrated, isAuthenticated, router, session.data]);

  if (hydrated && isAuthenticated && session.isError) {
    return <AdminShellFailure onRetry={() => session.refetch()} />;
  }

  if (!hydrated || !isAuthenticated || session.isPending || session.data?.role !== 'ADMIN') {
    return <AdminShellLoading />;
  }

  return (
    <AdminShellProvider>
      <Tooltip.Provider>
        <AdminWorkspace>{children}</AdminWorkspace>
      </Tooltip.Provider>
    </AdminShellProvider>
  );
}

function AdminWorkspace({ children }: { children: ReactNode }) {
  const { footer, mobileNavOpen, setMobileNavOpen } = useAdminShell();
  const { m } = useAdminI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);

  useEffect(() => {
    const stored = document.cookie
      .split('; ')
      .find((item) => item.startsWith(`${SIDEBAR_COOKIE}=`))
      ?.split('=')[1];
    setCollapsed(stored === 'collapsed');
  }, []);

  const toggleSidebar = () => {
    setCollapsed((current) => {
      const next = !current;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? 'collapsed' : 'expanded'}; path=/; max-age=604800; samesite=lax`;
      return next;
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        if (window.matchMedia('(min-width: 768px)').matches) toggleSidebar();
        else setMobileNavOpen(!mobileNavOpen);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen, setMobileNavOpen]);

  const compact = collapsed && !hoverExpanded;

  return (
    <div className="admin-surface fixed inset-0 z-50 flex overflow-hidden bg-background text-foreground">
      <div
        className={cn(
          'relative hidden h-full shrink-0 transition-[width] duration-200 md:block',
          collapsed ? 'w-12' : 'w-64',
        )}
      >
        <aside
          onMouseEnter={() => collapsed && setHoverExpanded(true)}
          onMouseLeave={() => setHoverExpanded(false)}
          className={cn(
            'absolute inset-y-0 left-0 z-30 border-r border-sidebar-border transition-[width,box-shadow] duration-200',
            compact ? 'w-12' : 'w-64',
            collapsed && hoverExpanded && 'shadow-lg',
          )}
        >
          <AdminSidebar compact={compact} collapsedState={collapsed} onCollapse={toggleSidebar} />
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader onOpenNavigation={() => setMobileNavOpen(true)} />
        <AdminPageHeader />
        <main className="min-h-0 flex-1 overflow-auto bg-background">{children}</main>
        {footer ? (
          <footer className="shrink-0 border-t border-border bg-background px-4 py-2 min-[426px]:px-10">
            {footer}
          </footer>
        ) : null}
      </div>

      <Dialog.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="admin-dialog-overlay fixed inset-0 z-[90] bg-black/50 md:hidden" />
          <Dialog.Content className="admin-mobile-nav fixed inset-y-0 left-0 z-[100] w-72 border-r border-sidebar-border bg-sidebar shadow-lg outline-none md:hidden">
            <Dialog.Title className="sr-only">{m.shell.mobileNavTitle}</Dialog.Title>
            <AdminSidebar
              compact={false}
              showCollapse={false}
              onNavigate={() => setMobileNavOpen(false)}
            />
            <Dialog.Close asChild>
              <AdminButton
                variant="ghost"
                size="iconSm"
                className="absolute right-2 top-4"
                aria-label={m.shell.closeNavigation}
              >
                <X />
              </AdminButton>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function AdminShellLoading() {
  const { m } = useAdminI18n();
  return (
    <div className="admin-surface fixed inset-0 z-50 flex items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <span className="mx-auto block size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="mt-3 text-sm font-medium">{m.shell.loading}</p>
      </div>
    </div>
  );
}

function AdminShellFailure({ onRetry }: { onRetry: () => void }) {
  const router = useRouter();
  const signOut = useSignOut();
  const { m } = useAdminI18n();

  return (
    <div className="admin-surface fixed inset-0 z-50 flex items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-lg font-semibold">{m.shell.failureTitle}</h1>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{m.shell.failureBody}</p>
        <div className="mt-6 flex justify-end gap-2">
          <AdminButton variant="secondary" onClick={onRetry}>
            {m.common.retry}
          </AdminButton>
          <AdminButton
            onClick={() =>
              signOut.mutate(undefined, { onSuccess: () => router.replace('/sign-in') })
            }
            disabled={signOut.isPending}
          >
            {m.shell.signOut}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
