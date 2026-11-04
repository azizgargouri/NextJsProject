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
import { useAdminShell } from '../shell/admin-shell-context';
import { QualityOverview } from './quality-overview';

export function AdminOverviewPortal() {
  const { setPage, clearPage, clearFooter } = useAdminShell();
  const overview = useAdminOverview();

  useEffect(() => {
    setPage({
      breadcrumbs: [{ label: 'Admin' }, { label: 'Overview' }],
      title: 'Operations overview',
      description: 'Account health and platform readiness from the live MoveUp database.',
      actions: (
        <AdminButton asChild size="sm">
          <Link href="/admin/users">
            Manage users <ArrowRight />
          </Link>
        </AdminButton>
      ),
    });
    clearFooter();
    return () => {
      clearPage();
      clearFooter();
    };
  }, [clearFooter, clearPage, setPage]);

  if (overview.isPending) return <OverviewSkeleton />;

  if (overview.isError || !overview.data) {
    return (
      <div className="p-4 min-[426px]:p-10">
        <AdminCard className="max-w-2xl p-6">
          <CircleAlert className="size-5 text-destructive" />
          <h2 className="mt-4 text-base font-semibold">Overview could not be loaded</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Check the MongoDB connection, then retry this request.
          </p>
          <AdminButton className="mt-5" size="sm" onClick={() => overview.refetch()}>
            Retry
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
                Account registry
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Live users by role and current access status.
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-3xl font-bold tracking-[-0.03em]">{users.total}</p>
              <p className="text-xs text-muted-foreground">total accounts</p>
            </div>
          </div>

          <div className="border-y border-border bg-muted/60 px-6 py-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold">Active access</span>
              <span className="text-muted-foreground">{activePercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-sm bg-border" aria-hidden>
              <div className="h-full bg-primary" style={{ width: `${activePercent}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {users.active} active · {users.blocked} blocked
            </p>
          </div>

          <div className="grid divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            {[
              ['Clients', users.clients],
              ['Movers', users.movers],
              ['Admins', users.admins],
              ['New · 30 days', users.registeredLast30Days],
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
            Mover verification
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Application review state.</p>
          <div className="mt-6 space-y-3">
            <StatusRow
              icon={CircleAlert}
              label="Pending review"
              value={movers.pendingReview}
              urgent={movers.pendingReview > 0}
            />
            <StatusRow icon={CircleCheck} label="Approved movers" value={movers.approved} />
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-xs leading-5 text-muted-foreground">
              The mover-review workflow is scheduled for the next admin vertical slice.
            </p>
          </div>
        </AdminCard>
      </div>

      <QualityOverview />

      <AdminCard className="overflow-hidden">
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database className="size-4 text-primary" />
            Operations data readiness
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            A-01 metrics remain unavailable until the move-request domain is connected.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="h-10 px-4 font-semibold">Metric</th>
                <th className="h-10 px-4 font-semibold">Current value</th>
                <th className="h-10 px-4 font-semibold">Source</th>
                <th className="h-10 px-4 font-semibold">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ['New requests', 'MoveRequest collection'],
                ['Moves in progress', 'MoveRequest status timeline'],
                ['Completed moves', 'MoveRequest completion state'],
                ['Revenue', 'Payment and commission records'],
              ].map(([label, source]) => (
                <tr key={label} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{label}</td>
                  <td className="px-4 py-3 text-base font-semibold">—</td>
                  <td className="px-4 py-3 text-muted-foreground">{source}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-muted-foreground/50" /> Not
                      connected
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
  return (
    <div className="space-y-6 p-4 min-[426px]:p-10" aria-label="Loading overview">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <AdminSkeleton className="h-72" />
        <AdminSkeleton className="h-72" />
      </div>
      <AdminSkeleton className="h-72" />
    </div>
  );
}
