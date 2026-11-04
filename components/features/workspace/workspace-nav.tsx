'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useWorkspace } from './workspace-context';

const LINKS = [
  { href: '/dashboard', label: 'Overview', exact: true },
  { href: '/request', label: 'Book Move' },
  { href: '/dashboard/homes', label: 'Smart Rooms' },
  { href: '/dashboard/claims', label: 'Claims' },
  { href: '/dashboard/reviews', label: 'Reviews' },
  { href: '/dashboard/assistant', label: 'Assistant' },
] as const;

/**
 * App-shell navigation (course ch.2 + workshop NavBar): mobile-first — a toggle menu under
 * `sm`, an inline bar from `sm:` up. The shell stays mounted while page content changes.
 */
export function WorkspaceNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const online = useOnlineStatus();
  const { isMover } = useWorkspace();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Workspace" className="border-b border-ink bg-paper">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 md:px-6">
        <div className="hidden sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href, 'exact' in link) ? 'page' : undefined}
              className={cn(
                'mono border-r border-ink px-5 py-3 text-[11px] transition-colors first:border-l hover:bg-ink hover:text-paper',
                isActive(link.href, 'exact' in link) && 'bg-ink text-paper',
              )}
            >
              {link.label === 'Reviews' && isMover ? 'My rating' : link.label}
            </Link>
          ))}
        </div>

        <button
          type="button"
          className="mono flex items-center gap-2 py-3 text-[11px] sm:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="workspace-mobile-menu"
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />} Menu
        </button>

        <p className="mono flex items-center gap-2 text-[10px] text-ink-80" role="status">
          <span
            className={cn('inline-block size-2', online ? 'bg-ink' : 'bg-hazard')}
            aria-hidden
          />
          {online ? 'ONLINE' : 'OFFLINE — CACHED VIEW'}
        </p>
      </div>

      {open ? (
        <div id="workspace-mobile-menu" className="flex flex-col border-t border-ink sm:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                'mono border-b border-ink px-4 py-3 text-[11px] last:border-b-0',
                isActive(link.href, 'exact' in link) && 'bg-ink text-paper',
              )}
            >
              {link.label === 'Reviews' && isMover ? 'My rating' : link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  );
}
