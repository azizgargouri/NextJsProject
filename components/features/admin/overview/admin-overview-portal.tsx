'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Database,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { AdminSkeleton } from '@/components/ui/admin-skeleton';
import { useAdminOverview } from '@/hooks/content/admin';
import { useAdminI18n } from '@/lib/i18n/admin';
import { useAdminShell } from '../shell/admin-shell-context';

export function AdminOverviewPortal() {
  const { setPage, clearPage, clearFooter } = useAdminShell();
  const overview = useAdminOverview();
  const { m } = useAdminI18n();

  useEffect(() => {
    setPage({
      breadcrumbs: [{ label: m.common.admin }, { label: m.nav.items.overview }],
      title: m.overview.title,
      description: m.overview.description,
      actions: (
        <AdminButton asChild size="sm">
          <Link href="/admin/users">
            {m.overview.manageUsers} <ArrowRight />
          </Link>
        </AdminButton>
      ),
    });
    clearFooter();
    return () => {
      clearPage();
      clearFooter();
    };
  }, [clearFooter, clearPage, m, setPage]);

  if (overview.isPending) return <OverviewSkeleton />;

  if (overview.isError || !overview.data) {
    return (
      <div className="p-4 min-[426px]:p-10">
        <AdminCard className="max-w-2xl p-6">
          <CircleAlert className="size-5 text-destructive" />
          <h2 className="mt-4 text-base font-semibold">{m.overview.loadFailed}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{m.overview.loadFailedBody}</p>
          <AdminButton className="mt-5" size="sm" onClick={() => overview.refetch()}>
            {m.common.retry}
          </AdminButton>
        </AdminCard>
      </div>
    );
  }

  const { users, movers } = overview.data;
  const activePercent = users.total ? Math.round((users.active / users.total) * 100) : 0;

  return (
    <div className="space-y-6 p-4 min-[426px]:p-10">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <AdminCard className="overflow-hidden">
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4 text-primary" />
                {m.overview.registry}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{m.overview.registryBody}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-3xl font-bold tracking-[-0.03em]">{users.total}</p>
              <p className="text-xs text-muted-foreground">{m.overview.totalAccounts}</p>
            </div>
          </div>

          <div className="border-y border-border bg-muted/60 px-6 py-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold">{m.overview.activeAccess}</span>
              <span className="text-muted-foreground">{activePercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-sm bg-border" aria-hidden>
              <div className="h-full bg-primary" style={{ width: `${activePercent}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {m.overview.activeBlocked(users.active, users.blocked)}
            </p>
          </div>

          <div className="grid divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            {[
              [m.overview.clients, users.clients],
              [m.overview.movers, users.movers],
              [m.overview.admins, users.admins],
              [m.overview.new30, users.registeredLast30Days],
            ].map(([label, value]) => (
              <div key={label} className="px-6 py-4">
                <p className="text-xl font-bold tracking-[-0.02em]">{value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard className="p-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-primary" />
            {m.overview.verification}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{m.overview.verificationBody}</p>
          <div className="mt-6 space-y-3">
            <StatusRow
              icon={CircleAlert}
              label={m.overview.pendingReview}
              value={movers.pendingReview}
              urgent={movers.pendingReview > 0}
            />
            <StatusRow
              icon={CircleCheck}
              label={m.overview.approvedMovers}
              value={movers.approved}
            />
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-xs leading-5 text-muted-foreground">{m.overview.verificationNote}</p>
          </div>
        </AdminCard>
      </div>

      <AdminCard className="overflow-hidden">
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database className="size-4 text-primary" />
            {m.overview.readiness}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{m.overview.readinessBody}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="h-10 px-4 font-semibold">{m.overview.columns.metric}</th>
                <th className="h-10 px-4 font-semibold">{m.overview.columns.value}</th>
                <th className="h-10 px-4 font-semibold">{m.overview.columns.source}</th>
                <th className="h-10 px-4 font-semibold">{m.overview.columns.state}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {m.overview.metrics.map(([label, source]) => (
                <tr key={label} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{label}</td>
                  <td className="px-4 py-3 text-base font-semibold">—</td>
                  <td className="px-4 py-3 text-muted-foreground">{source}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-muted-foreground/50" />{' '}
                      {m.overview.notConnected}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </div>
  );
}

function StatusRow({
  icon: Icon,
  label,
  value,
  urgent = false,
}: {
  icon: typeof UserRoundCheck;
  label: string;
  value: number;
  urgent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-3">
      <span className="flex items-center gap-2 text-sm">
        <Icon className={urgent ? 'size-4 text-destructive' : 'size-4 text-muted-foreground'} />
        {label}
      </span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

function OverviewSkeleton() {
  const { m } = useAdminI18n();
  return (
    <div className="space-y-6 p-4 min-[426px]:p-10" aria-label={m.overview.loadingLabel}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <AdminSkeleton className="h-72" />
        <AdminSkeleton className="h-72" />
      </div>
      <AdminSkeleton className="h-72" />
    </div>
  );
}
