'use client';

import { useEffect, useState } from 'react';
import {
  BriefcaseBusiness,
  CircleAlert,
  Home,
  Loader2,
  MessageSquareWarning,
  RefreshCcw,
  Sparkles,
  Trash2,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { AdminDialog } from '@/components/ui/admin-dialog';
import { AdminSkeleton } from '@/components/ui/admin-skeleton';
import { useAdminPlayground, useRunPlayground } from '@/hooks/content/admin';
import { useAdminI18n } from '@/lib/i18n/admin';
import type { PlaygroundModuleKey } from '@/types';
import { useAdminShell } from '../shell/admin-shell-context';

const ICONS: Record<PlaygroundModuleKey, LucideIcon> = {
  accounts: Users,
  bookings: Truck,
  smartRooms: Home,
  quality: MessageSquareWarning,
  hr: BriefcaseBusiness,
};

/** Admin seeder playground: per-module fake data, seeded or removed on demand. */
export function PlaygroundPortal() {
  const { setPage, clearPage } = useAdminShell();
  const { m, locale } = useAdminI18n();
  const playground = useAdminPlayground();
  const run = useRunPlayground();
  const [running, setRunning] = useState<PlaygroundModuleKey | 'all' | 'reset' | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const refetch = playground.refetch;
  const enabled = playground.data?.enabled ?? false;
  const busy = run.isPending;

  const execute = (
    target: PlaygroundModuleKey | 'all' | 'reset',
    payload: Parameters<typeof run.mutate>[0],
  ) => {
    setRunning(target);
    run.mutate(payload, {
      onSuccess: () => {
        toast.success(target === 'reset' ? m.playground.resetDone : m.playground.seeded);
        setConfirmReset(false);
      },
      onError: () => toast.error(m.playground.failed),
      onSettled: () => setRunning(null),
    });
  };

  useEffect(() => {
    setPage({
      breadcrumbs: [{ label: m.common.admin, href: '/admin' }, { label: m.playground.title }],
      title: m.playground.title,
      description: m.playground.description,
      actions: (
        <div className="flex flex-wrap items-center gap-2">
          <AdminButton size="sm" variant="outline" onClick={() => void refetch()}>
            <RefreshCcw />
            {m.playground.refresh}
          </AdminButton>
          <AdminButton
            size="sm"
            variant="outline"
            disabled={!enabled || busy}
            onClick={() => setConfirmReset(true)}
          >
            <Trash2 />
            {m.playground.reset}
          </AdminButton>
          <AdminButton
            size="sm"
            disabled={!enabled || busy}
            onClick={() => execute('all', { action: 'seed' })}
          >
            {running === 'all' ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {m.playground.seedAll}
          </AdminButton>
        </div>
      ),
    });
    return () => clearPage();
    // `execute` is recreated each render; the header only needs these inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, clearPage, enabled, m, refetch, running, setPage]);

  if (playground.isLoading) {
    return (
      <div className="grid gap-4 p-4 min-[426px]:p-10 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <AdminSkeleton key={index} className="h-40" />
        ))}
      </div>
    );
  }

  if (playground.isError || !playground.data) {
    return (
      <AdminCard className="m-4 flex items-center gap-3 p-6 text-sm min-[426px]:m-10">
        <CircleAlert className="size-4 text-destructive" />
        {m.playground.failed}
      </AdminCard>
    );
  }

  const { status, modules, domain, password } = playground.data;

  return (
    <div className="space-y-4 p-4 min-[426px]:p-10">
      {!enabled && (
        <AdminCard className="flex items-start gap-3 border-amber-500/40 p-4 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          {m.playground.disabled}
        </AdminCard>
      )}

      <p className="text-sm text-muted-foreground">{m.playground.logins(domain, password)}</p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((key) => {
          const Icon = ICONS[key];
          const copy = m.playground.modules[key];
          const counts = Object.entries(status[key] ?? {});
          const filled = counts.some(([, count]) => count > 0);
          return (
            <AdminCard key={key} className="flex flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">{copy.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{copy.body}</p>
                </div>
              </div>
              <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {counts.map(([name, count]) => (
                  <div key={name} className="flex items-baseline gap-1">
                    <dt className="sr-only">{m.playground.counts[name] ?? name}</dt>
                    <dd className="font-semibold tabular-nums">{count.toLocaleString(locale)}</dd>
                    <span aria-hidden className="text-muted-foreground">
                      {m.playground.counts[name] ?? name}
                    </span>
                  </div>
                ))}
              </dl>
              <div className="mt-auto flex justify-end">
                <AdminButton
                  size="sm"
                  variant={filled ? 'outline' : 'default'}
                  disabled={!enabled || busy}
                  onClick={() => execute(key, { action: 'seed', modules: [key] })}
                >
                  {running === key ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {m.playground.seed}
                </AdminButton>
              </div>
            </AdminCard>
          );
        })}
      </div>

      <AdminDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={m.playground.resetTitle}
        description={m.playground.resetBody}
        footer={
          <>
            <AdminButton variant="outline" onClick={() => setConfirmReset(false)} disabled={busy}>
              {m.playground.cancel}
            </AdminButton>
            <AdminButton
              variant="destructive"
              disabled={busy}
              onClick={() => execute('reset', { action: 'reset' })}
            >
              {running === 'reset' ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {m.playground.confirmReset}
            </AdminButton>
          </>
        }
      />
    </div>
  );
}
