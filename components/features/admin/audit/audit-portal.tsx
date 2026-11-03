'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CircleAlert, History, RotateCcw } from 'lucide-react';
import { AdminBadge } from '@/components/ui/admin-badge';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { AdminSelect } from '@/components/ui/admin-select';
import { useAdminAudit } from '@/hooks/content/admin';
import type { AuditEventType } from '@/types';
import { useAdminShell } from '../shell/admin-shell-context';

const EVENT_LABELS: Record<AuditEventType, string> = {
  SIGNIN: 'Sign in',
  SIGNOUT: 'Sign out',
  SIGNUP: 'Sign up',
  REFRESH_TOKEN: 'Session refresh',
  USER_CREATE: 'User created',
  USER_UPDATE: 'User updated',
  USER_DELETE: 'User deleted',
  USER_STATUS: 'User status changed',
};

const EVENT_VARIANTS: Record<AuditEventType, 'default' | 'secondary' | 'destructive'> = {
  SIGNIN: 'secondary',
  SIGNOUT: 'secondary',
  SIGNUP: 'secondary',
  REFRESH_TOKEN: 'secondary',
  USER_CREATE: 'default',
  USER_UPDATE: 'default',
  USER_DELETE: 'destructive',
  USER_STATUS: 'destructive',
};

const eventOptions = [
  { value: 'ALL', label: 'All events' },
  ...(Object.keys(EVENT_LABELS) as AuditEventType[]).map((event) => ({
    value: event,
    label: EVENT_LABELS[event],
  })),
];

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'medium',
});

export function AuditPortal() {
  const { setPage: publishPage, clearPage, clearFooter } = useAdminShell();
  const [event, setEvent] = useState<AuditEventType | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;
  const audit = useAdminAudit({ page, limit, event });

  useEffect(() => {
    publishPage({
      breadcrumbs: [{ label: 'Admin', href: '/admin' }, { label: 'Audit log' }],
      title: 'Audit log',
      description: 'Security and administration trail recorded by the platform server.',
    });
    clearFooter();
    return () => {
      clearPage();
      clearFooter();
    };
  }, [clearFooter, clearPage, publishPage]);

  useEffect(() => setPage(1), [event]);

  const empty = !audit.isPending && audit.data && audit.data.data.length === 0;

  return (
    <div className="p-4 min-[426px]:p-10">
      <AdminCard className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-primary" />
            Recorded events
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="audit-event-filter" className="sr-only">
              Filter by event type
            </label>
            <AdminSelect
              id="audit-event-filter"
              value={event}
              onValueChange={(value) => setEvent(value as AuditEventType | 'ALL')}
              options={eventOptions}
              ariaLabel="Filter by event type"
            />
          </div>
        </div>

        {audit.isPending ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-9 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : null}

        {audit.isError ? (
          <div className="px-6 py-12 text-center">
            <CircleAlert className="mx-auto size-5 text-destructive" />
            <p className="mt-3 font-semibold">Audit trail could not be loaded.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Check the MongoDB connection, then retry this request.
            </p>
            <AdminButton className="mt-4" size="sm" onClick={() => audit.refetch()}>
              <RotateCcw /> Retry
            </AdminButton>
          </div>
        ) : null}

        {empty ? (
          <div className="px-6 py-12 text-center">
            <History className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 font-semibold">No events recorded yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Every sign-in and account action appends here automatically.
            </p>
          </div>
        ) : null}

        {audit.data && audit.data.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="h-10 px-6 font-semibold">Event</th>
                  <th className="h-10 px-3 font-semibold">Actor</th>
                  <th className="h-10 px-3 font-semibold">Action</th>
                  <th className="h-10 px-3 font-semibold">Target</th>
                  <th className="h-10 px-6 text-right font-semibold">Recorded at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {audit.data.data.map((eventRow) => (
                  <tr key={eventRow.id} className="text-foreground">
                    <td className="px-6 py-2.5">
                      <AdminBadge variant={EVENT_VARIANTS[eventRow.event]}>
                        {EVENT_LABELS[eventRow.event]}
                      </AdminBadge>
                    </td>
                    <td className="px-3 py-2.5">
                      {eventRow.actor ? (
                        <span className="block truncate">
                          <span className="font-semibold">{eventRow.actor.name}</span>
                          <span className="block truncate text-muted-foreground">
                            {eventRow.actor.email}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">System / unsaved user</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px]">
                      {eventRow.method} {eventRow.api}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {targetSummary(eventRow.logInfo)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-2.5 text-right text-muted-foreground">
                      {timeFormatter.format(new Date(eventRow.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {audit.data && audit.data.meta.pageCount > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Page {audit.data.meta.page} of {audit.data.meta.pageCount} ·{' '}
              {audit.data.meta.itemCount} events
            </p>
            <div className="flex items-center gap-2">
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                aria-label="Previous audit page"
              >
                <ChevronLeft /> Previous
              </AdminButton>
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => current + 1)}
                disabled={!audit.data.meta.hasNextPage}
                aria-label="Next audit page"
              >
                Next <ChevronRight />
              </AdminButton>
            </div>
          </div>
        ) : null}
      </AdminCard>
    </div>
  );
}

function targetSummary(logInfo: Record<string, string | undefined>): string {
  const parts = Object.entries(logInfo)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${String(key).replace(/Id$/, '').toLowerCase()} ${value}`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}
