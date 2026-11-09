'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AuthUser } from '@/hooks/stores/auth-store';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { cn } from '@/lib/utils';

export interface WorkspaceLink {
  href: string;
  label: string;
  /** Active only on this exact path (e.g. the overview, which prefixes everything). */
  exact?: boolean;
}

/** Everything a client works with, in one place: booking, tracking, smart rooms, after-move. */
const CLIENT_LINKS: WorkspaceLink[] = [
  { href: '/dashboard', label: 'Overview', exact: true },
  { href: '/request', label: 'Book move' },
  { href: '/track', label: 'Live tracking' },
  { href: '/dashboard/homes', label: 'Smart rooms' },
  { href: '/dashboard/claims', label: 'Claims' },
  { href: '/dashboard/reviews', label: 'Reviews' },
  { href: '/dashboard/assistant', label: 'Assistant' },
];

/** Movers work in /mover; these are the HR pages they reach from it as crew members. */
const MOVER_LINKS: WorkspaceLink[] = [
  { href: '/mover', label: 'Mover workspace' },
  { href: '/me', label: 'HR file' },
  { href: '/contracts', label: 'Contracts' },
  { href: '/profile', label: 'Profile' },
];

const ADMIN_LINKS: WorkspaceLink[] = [
  { href: '/dashboard', label: 'Workspace', exact: true },
  { href: '/admin', label: 'Admin back-office' },
  { href: '/employees', label: 'Employees' },
  { href: '/attendance', label: 'Attendance' },
  { href: '/leave', label: 'Leave' },
  { href: '/contracts', label: 'Contracts' },
  { href: '/profile', label: 'Profile' },
];

export function workspaceLinks(role: AuthUser['role'] | undefined): WorkspaceLink[] {
  if (role === 'ADMIN') return ADMIN_LINKS;
  if (role === 'MOVER') return MOVER_LINKS;
  return CLIENT_LINKS;
}

/** Where the logo takes each role. */
export function workspaceHome(role: AuthUser['role'] | undefined): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'MOVER') return '/mover';
  return '/dashboard';
}

export function isLinkActive(pathname: string, link: WorkspaceLink): boolean {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

/** Inline links for a header (desktop) or a scrollable strip (mobile). */
export function WorkspaceLinkList({
  links,
  variant,
}: {
  links: WorkspaceLink[];
  variant: 'inline' | 'strip';
}) {
  const pathname = usePathname();
  return (
    <>
      {links.map((link) => {
        const active = isLinkActive(pathname, link);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'mono whitespace-nowrap border-b-2 text-[11px] transition-colors',
              variant === 'inline' ? 'pb-1' : 'pb-0.5',
              active
                ? 'border-hazard font-bold text-ink'
                : 'border-transparent text-ink-60 hover:text-ink',
            )}
          >
            {link.label.toUpperCase()}
          </Link>
        );
      })}
    </>
  );
}

/**
 * The client's workspace links on pages that also serve guests (/request, /track):
 * signed-in clients keep the same navigation as the rest of the workspace.
 */
export function ClientWorkspaceBar() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !isAuthenticated || user?.role !== 'CLIENT') return null;
  return (
    <nav
      aria-label="Workspace"
      className="no-scrollbar flex gap-5 overflow-x-auto border-b border-ink/15 bg-paper-soft px-4 py-2.5 md:px-6"
    >
      <div className="mx-auto flex w-full max-w-7xl gap-5">
        <WorkspaceLinkList links={CLIENT_LINKS} variant="strip" />
      </div>
    </nav>
  );
}
