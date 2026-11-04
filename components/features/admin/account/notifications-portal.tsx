'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { BellOff, CheckCheck, CircleAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { AdminSkeleton } from '@/components/ui/admin-skeleton';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAccountNotifications, useMarkNotificationsRead } from '@/hooks/content/account';
import { useAdminI18n } from '@/lib/i18n/admin';
import { cn } from '@/lib/utils';
import { useAdminShell } from '../shell/admin-shell-context';
import { readServerError } from './account-field';
import { describeNotification } from './notification-copy';

export function NotificationsPortal() {
  const { setPage, clearPage, setFooter, clearFooter } = useAdminShell();
  const feed = useAccountNotifications();
  const markRead = useMarkNotificationsRead();
  const { mutate: markAllRead, isPending: marking } = markRead;
  const { m, fmt } = useAdminI18n();
  const unread = feed.data?.pages[0]?.unreadCount ?? 0;
  const items = feed.data?.pages.flatMap((page) => page.data) ?? [];

  useEffect(() => {
    setPage({
      breadcrumbs: [{ label: m.common.admin, href: '/admin' }, { label: m.notifications.title }],
      title: m.notifications.title,
      description: m.notifications.description,
      actions: (
        <AdminButton
          size="sm"
          variant="outline"
          disabled={unread === 0 || marking}
          onClick={() =>
            markAllRead(undefined, {
              onSuccess: () => toast.success(m.notifications.marked),
              onError: (error) =>
                toast.error(readServerError(error, m.common.requestFailed).message),
            })
          }
        >
          {marking ? <Loader2 className="animate-spin" /> : <CheckCheck />}
          {m.notifications.markAll}
        </AdminButton>
      ),
    });
    return () => {
      clearPage();
    };
  }, [clearPage, m, markAllRead, marking, setPage, unread]);

  useEffect(() => {
    setFooter(
      <p className="text-xs text-muted-foreground">
        {feed.data ? m.notifications.footer(items.length, unread) : m.notifications.loading}
      </p>,
    );
    return clearFooter;
  }, [clearFooter, feed.data, items.length, m, setFooter, unread]);

  return (
    <div className="p-4 min-[426px]:p-10">
      <AdminCard className="mx-auto max-w-3xl overflow-hidden">
        {feed.isPending ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }, (_, index) => (
              <AdminSkeleton key={index} className="h-12" />
            ))}
          </div>
        ) : feed.isError ? (
          <div className="p-10 text-center">
            <CircleAlert className="mx-auto size-5 text-destructive" />
            <p className="mt-3 font-semibold">{m.notifications.loadFailed}</p>
            <AdminButton className="mt-4" size="sm" onClick={() => feed.refetch()}>
              {m.common.retry}
            </AdminButton>
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <BellOff className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 font-semibold">{m.notifications.empty}</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
              {m.notifications.emptyBody}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const { title, href } = describeNotification(m, item);
              const body = (
                <>
                  <span
                    className={cn(
                      'mt-3 size-2 shrink-0 rounded-full',
                      item.unread ? 'bg-primary' : 'bg-transparent',
                    )}
                    aria-hidden
                  />
                  <UserAvatar name={item.actor?.name ?? 'MoveUp'} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', item.unread && 'font-semibold')}>
                      {title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      <time dateTime={item.createdAt} title={fmt.dateTime(item.createdAt)}>
                        {fmt.relative(item.createdAt)}
                      </time>
                      {item.actor ? ` · ${item.actor.email}` : null}
                    </span>
                  </span>
                  {item.unread ? <span className="sr-only">{m.notifications.unread}</span> : null}
                </>
              );
              return (
                <li key={item.id}>
                  {href ? (
                    <Link
                      href={href}
                      className="flex items-start gap-3 px-5 py-4 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 px-5 py-4">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {feed.hasNextPage ? (
          <div className="border-t border-border p-4 text-center">
            <AdminButton
              size="sm"
              variant="ghost"
              onClick={() => feed.fetchNextPage()}
              disabled={feed.isFetchingNextPage}
            >
              {feed.isFetchingNextPage ? <Loader2 className="animate-spin" /> : null}
              {m.notifications.loadOlder}
            </AdminButton>
          </div>
        ) : null}
      </AdminCard>
    </div>
  );
}
