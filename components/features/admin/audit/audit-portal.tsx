'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CircleAlert, History, RotateCcw } from 'lucide-react';
import { AdminBadge } from '@/components/ui/admin-badge';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { AdminSelect } from '@/components/ui/admin-select';
import { useAdminAudit } from '@/hooks/content/admin';
import { useAdminI18n } from '@/lib/i18n/admin';
import type { AuditEventType } from '@/types';
import { useAdminShell } from '../shell/admin-shell-context';

const EVENT_VARIANTS: Record<AuditEventType, 'default' | 'secondary' | 'destructive'> = {
  SIGNIN: 'secondary',
  SIGNOUT: 'secondary',
  SIGNUP: 'secondary',
  REFRESH_TOKEN: 'secondary',
  USER_CREATE: 'default',
  USER_UPDATE: 'default',
  USER_DELETE: 'destructive',
  USER_STATUS: 'destructive',
  PRICING_CREATE: 'default',
  PRICING_UPDATE: 'default',
  PRICING_DELETE: 'destructive',
  CONTENT_UPDATE: 'default',
  PROFILE_UPDATE: 'secondary',
  AVATAR_UPDATE: 'secondary',
  PASSWORD_CHANGE: 'default',
  SESSION_REVOKE: 'secondary',
  STORAGE_DELETE: 'destructive',
};

export function AuditPortal() {
  const { setPage: publishPage, clearPage, clearFooter } = useAdminShell();
  const [event, setEvent] = useState<AuditEventType | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;
  const audit = useAdminAudit({ page, limit, event });
  const { m, fmt } = useAdminI18n();
  const eventOptions = [
    { value: 'ALL', label: m.audit.allEvents },
    ...(Object.keys(EVENT_VARIANTS) as AuditEventType[]).map((value) => ({
      value,
      label: m.audit.events[value],
    })),
  ];

  useEffect(() => {
    publishPage({
      breadcrumbs: [{ label: m.common.admin, href: '/admin' }, { label: m.audit.title }],
      title: m.audit.title,
      description: m.audit.description,
    });
    clearFooter();
    return () => {
      clearPage();
      clearFooter();
    };
  }, [clearFooter, clearPage, m, publishPage]);

  useEffect(() => setPage(1), [event]);

  const empty = !audit.isPending && audit.data && audit.data.data.length === 0;

  return (
    <div className="p-4 min-[426px]:p-10">
      <AdminCard className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-primary" />
            {m.audit.recorded}
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="audit-event-filter" className="sr-only">
              {m.audit.filter}
            </label>
            <AdminSelect
              id="audit-event-filter"
              value={event}
              onValueChange={(value) => setEvent(value as AuditEventType | 'ALL')}
              options={eventOptions}
              ariaLabel={m.audit.filter}
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
            <p className="mt-3 font-semibold">{m.audit.loadFailed}</p>
            <p className="mt-1 text-xs text-muted-foreground">{m.audit.loadFailedBody}</p>
            <AdminButton className="mt-4" size="sm" onClick={() => audit.refetch()}>
              <RotateCcw /> {m.common.retry}
            </AdminButton>
          </div>
        ) : null}

        {empty ? (
          <div className="px-6 py-12 text-center">
            <History className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 font-semibold">{m.audit.empty}</p>
            <p className="mt-1 text-xs text-muted-foreground">{m.audit.emptyBody}</p>
          </div>
        ) : null}

        {audit.data && audit.data.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="h-10 px-6 font-semibold">{m.audit.columns.event}</th>
                  <th className="h-10 px-3 font-semibold">{m.audit.columns.actor}</th>
                  <th className="h-10 px-3 font-semibold">{m.audit.columns.action}</th>
                  <th className="h-10 px-3 font-semibold">{m.audit.columns.target}</th>
                  <th className="h-10 px-6 text-right font-semibold">
                    {m.audit.columns.recordedAt}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {audit.data.data.map((eventRow) => (
                  <tr key={eventRow.id} className="text-foreground">
                    <td className="px-6 py-2.5">
                      <AdminBadge variant={EVENT_VARIANTS[eventRow.event]}>
                        {m.audit.events[eventRow.event] ?? eventRow.event}
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
                        <span className="text-muted-foreground">{m.audit.system}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px]">
                      {eventRow.method} {eventRow.api}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {targetSummary(eventRow.logInfo)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-2.5 text-right text-muted-foreground">
                      {fmt.dateTimeSeconds(eventRow.createdAt)}
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
              {m.common.pageOf(audit.data.meta.page, audit.data.meta.pageCount)} ·{' '}
              {m.audit.eventCount(audit.data.meta.itemCount)}
            </p>
            <div className="flex items-center gap-2">
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                aria-label={m.audit.previousPage}
              >
                <ChevronLeft /> {m.common.previous}
              </AdminButton>
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => current + 1)}
                disabled={!audit.data.meta.hasNextPage}
                aria-label={m.audit.nextPage}
              >
                {m.common.next} <ChevronRight />
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
