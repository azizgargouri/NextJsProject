'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ChevronsLeft, ChevronsRight, LockKeyhole } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminButton } from '@/components/ui/admin-button';
import { adminNavGroups, type AdminNavItem } from './admin-nav';

interface AdminSidebarProps {
  compact: boolean;
  collapsedState?: boolean;
  onCollapse?: () => void;
  onNavigate?: () => void;
  showCollapse?: boolean;
}

export function AdminSidebar({
  compact,
  collapsedState = compact,
  onCollapse,
  onNavigate,
  showCollapse = true,
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-3">
        <Link
          href="/admin"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="MoveUp Admin overview"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            M
          </span>
          {!compact ? (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold">MoveUp</span>
              <span className="block truncate text-xs text-muted-foreground">Admin Panel</span>
            </span>
          ) : null}
        </Link>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3"
        aria-label="Admin"
      >
        {adminNavGroups.map((group, groupIndex) => (
          <div key={group.label} className={cn(groupIndex > 0 && 'mt-5')}>
            {!compact ? (
              <p className="mb-1.5 px-2 text-[11px] font-semibold text-muted-foreground">
                {group.label}
              </p>
            ) : groupIndex > 0 ? (
              <div className="mx-2 mb-2 border-t border-sidebar-border" />
            ) : null}
            <div className="space-y-1">
              {group.items.map((item) => (
                <SidebarItem
                  key={item.label}
                  item={item}
                  pathname={pathname}
                  compact={compact}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {showCollapse ? (
        <div className="shrink-0 border-t border-sidebar-border p-2">
          <AdminButton
            variant="ghost"
            size={compact ? 'iconSm' : 'sm'}
            className={cn('text-muted-foreground', !compact && 'w-full justify-start')}
            onClick={onCollapse}
            aria-label={collapsedState ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsedState ? <ChevronsRight /> : <ChevronsLeft />}
            {!compact ? <span>{collapsedState ? 'Pin open' : 'Collapse'}</span> : null}
          </AdminButton>
        </div>
      ) : null}
    </div>
  );
}

function SidebarItem({
  item,
  pathname,
  compact,
  onNavigate,
}: {
  item: AdminNavItem;
  pathname: string;
  compact: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = item.href
    ? item.href === '/admin'
      ? pathname === '/admin'
      : pathname.startsWith(item.href)
    : false;

  const content = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-label={compact ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-9 items-center gap-3 rounded-md px-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
        active
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
          : item.upcoming
            ? 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        compact && 'justify-center',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!compact ? (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.upcoming ? (
            <span className="rounded-md border border-sidebar-border px-1.5 py-0.5 text-[10px]">
              Soon
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );

  if (!compact) return content;

  return (
    <Tooltip.Root delayDuration={250}>
      <Tooltip.Trigger asChild>{content}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="z-[130] flex items-center gap-2 rounded-md border border-border bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md"
        >
          {item.label}
          {item.upcoming ? <LockKeyhole className="size-3 text-muted-foreground" /> : null}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
