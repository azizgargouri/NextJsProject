'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useMarkNotificationsRead, useMoverNotifications } from '@/hooks/content/mover';
import { cn } from '@/lib/utils';
import type { NotificationDto } from '@/types';
import { EmptyState, ErrorState, formatDateTime, LoadingState, PageTitle, Panel } from './mover-ui';

/** Item 12: new offers and status changes, in the app. */
export function NotificationsPortal() {
  const router = useRouter();
  const notifications = useMoverNotifications();
  const markRead = useMarkNotificationsRead();

  if (notifications.isPending) return <LoadingState label="Loading notifications" />;
  if (notifications.isError) {
    return <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />;
  }
  const { unreadCount, notifications: rows } = notifications.data;

  const open = (entry: NotificationDto) => {
    if (!entry.readAt) markRead.mutate([entry.id]);
    if (entry.link) router.push(entry.link);
  };

  return (
    <>
      <PageTitle title="Notifications" />
      <Panel
        title={unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
        action={
          unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={markRead.isPending}
              onClick={() => markRead.mutate(undefined)}
            >
              Mark all as read
            </Button>
          ) : null
        }
      >
        {rows.length === 0 ? (
          <EmptyState title="Nothing yet" body="New offers and job updates will show up here." />
        ) : (
          <ul className="-my-1 divide-y divide-ink/20">
            {rows.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => open(entry)}
                  className="flex w-full gap-3 py-3 text-left hover:bg-paper-soft focus-visible:outline-2 focus-visible:outline-hazard"
                >
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0',
                      entry.readAt ? 'bg-transparent' : 'bg-hazard-dark',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', !entry.readAt && 'font-bold')}>
                      {entry.readAt ? '' : <span className="sr-only">Unread: </span>}
                      {entry.title}
                    </span>
                    {entry.body ? (
                      <span className="block break-words text-sm text-ink-80">{entry.body}</span>
                    ) : null}
                    <span className="mt-1 block text-xs text-ink-80">
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
