'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Database, Radar } from 'lucide-react';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { useAdminI18n, type AdminMessages } from '@/lib/i18n/admin';
import { useAdminShell } from './shell/admin-shell-context';

export type NotConnectedModule = keyof AdminMessages['notConnected']['modules'];

/**
 * Shared landing page for back-office modules whose product domain is not
 * connected yet. States the gap honestly — no fabricated rows or metrics.
 */
export function AdminModuleNotConnected({ module }: { module: NotConnectedModule }) {
  const { setPage: publishPage, clearPage, clearFooter } = useAdminShell();
  const { m } = useAdminI18n();
  const label = m.nav.items[module];
  const { description, planned } = m.notConnected.modules[module];

  useEffect(() => {
    publishPage({
      breadcrumbs: [{ label: m.common.admin, href: '/admin' }, { label }],
      title: label,
      description,
    });
    clearFooter();
    return () => {
      clearPage();
      clearFooter();
    };
  }, [clearFooter, clearPage, description, label, m, publishPage]);

  return (
    <div className="p-4 min-[426px]:p-10">
      <AdminCard className="mx-auto max-w-2xl p-8 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted">
          <Radar className="size-5 text-primary" />
        </div>
        <h2 className="mt-5 text-base font-semibold">{m.notConnected.title(label)}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {m.notConnected.body}
        </p>

        <div className="mt-6 border-t border-border pt-6 text-left">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Database className="size-3.5 text-muted-foreground" />
            {m.notConnected.planned}
          </div>
          <ul className="mt-3 space-y-1.5 text-xs leading-5 text-muted-foreground">
            {planned.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-7 flex justify-center gap-3">
          <AdminButton asChild variant="secondary" size="sm">
            <Link href="/admin">
              {m.notConnected.backToOverview} <ArrowRight />
            </Link>
          </AdminButton>
          <AdminButton asChild size="sm">
            <Link href="/admin/users">
              {m.notConnected.manageUsers} <ArrowRight />
            </Link>
          </AdminButton>
        </div>
      </AdminCard>
    </div>
  );
}
