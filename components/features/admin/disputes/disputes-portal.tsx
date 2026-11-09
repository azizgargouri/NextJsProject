'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CircleAlert, Gavel, RotateCcw, Search } from 'lucide-react';
import { AdminBadge } from '@/components/ui/admin-badge';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { AdminInput } from '@/components/ui/admin-input';
import { AdminSelect } from '@/components/ui/admin-select';
import { useAdminClaims, useAdminQuality } from '@/hooks/content/admin';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  CLAIM_CATEGORIES,
  CLAIM_CATEGORY_LABELS,
  CLAIM_PRIORITIES,
  CLAIM_PRIORITY_LABELS,
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
} from '@/lib/quality/constants';
import type { ClaimCategory, ClaimPriority, ClaimStatus } from '@/types';
import { useAdminShell } from '../shell/admin-shell-context';
import { adminDate } from '../quality-ui';
import { ClaimSheet } from './claim-sheet';

export const STATUS_VARIANT: Record<
  ClaimStatus,
  'default' | 'secondary' | 'outline' | 'destructive' | 'success'
> = {
  OPEN: 'destructive',
  UNDER_REVIEW: 'default',
  RESOLVED: 'success',
  REJECTED: 'outline',
};

export const PRIORITY_VARIANT: Record<
  ClaimPriority,
  'secondary' | 'default' | 'destructive' | 'outline'
> = {
  LOW: 'outline',
  MEDIUM: 'secondary',
  HIGH: 'default',
  URGENT: 'destructive',
};

const options = <T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
  all: string,
) => [{ value: 'ALL', label: all }, ...values.map((value) => ({ value, label: labels[value] }))];

/** A-08 dispute desk: inbox with filters → sheet with evidence, AI triage and decision. */
export function DisputesPortal() {
  const { setPage: publishPage, clearPage, clearFooter } = useAdminShell();
  const [status, setStatus] = useState<ClaimStatus | 'ALL'>('OPEN');
  const [priority, setPriority] = useState<ClaimPriority | 'ALL'>('ALL');
  const [category, setCategory] = useState<ClaimCategory | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const claims = useAdminClaims({
    page,
    limit: 15,
    status,
    priority,
    category,
    search: debouncedSearch || undefined,
  });
  const quality = useAdminQuality();

  useEffect(() => {
    publishPage({
      breadcrumbs: [{ label: 'Admin', href: '/admin' }, { label: 'Disputes' }],
      title: 'Disputes',
      description: 'Client claims about moves: triage, gather both sides, record a decision.',
    });
    clearFooter();
    return () => {
      clearPage();
      clearFooter();
    };
  }, [clearFooter, clearPage, publishPage]);

  useEffect(() => setPage(1), [status, priority, category, debouncedSearch]);

  const stats = quality.data?.claims;

  return (
    <div className="space-y-6 p-4 min-[426px]:p-10">
      <div className="grid gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-4">
        {[
          ['Open', stats?.byStatus.OPEN],
          ['Under review', stats?.byStatus.UNDER_REVIEW],
          ['High / urgent in progress', stats?.urgentOpen],
          [
            'Avg. time to resolve',
            stats
              ? stats.avgResolutionHours !== null
                ? `${stats.avgResolutionHours} h`
                : '—'
              : undefined,
          ],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-card px-5 py-4">
            <p className="text-xl font-bold tracking-[-0.02em]">{value ?? '…'}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <AdminCard className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Gavel className="size-4 text-primary" /> Claims inbox
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <label htmlFor="claims-search" className="sr-only">
                Search claims
              </label>
              <AdminInput
                id="claims-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Reference, subject, move…"
                className="w-56 pl-8"
              />
            </div>
            <AdminSelect
              value={status}
              onValueChange={(value) => setStatus(value as ClaimStatus | 'ALL')}
              options={options(CLAIM_STATUSES, CLAIM_STATUS_LABELS, 'All statuses')}
              ariaLabel="Filter by status"
            />
            <AdminSelect
              value={priority}
              onValueChange={(value) => setPriority(value as ClaimPriority | 'ALL')}
              options={options(CLAIM_PRIORITIES, CLAIM_PRIORITY_LABELS, 'All priorities')}
              ariaLabel="Filter by priority"
            />
            <AdminSelect
              value={category}
              onValueChange={(value) => setCategory(value as ClaimCategory | 'ALL')}
              options={options(CLAIM_CATEGORIES, CLAIM_CATEGORY_LABELS, 'All categories')}
              ariaLabel="Filter by category"
            />
          </div>
        </div>

        {claims.isPending ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-9 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : null}

        {claims.isError ? (
          <div className="px-6 py-12 text-center">
            <CircleAlert className="mx-auto size-5 text-destructive" />
            <p className="mt-3 font-semibold">Claims could not be loaded.</p>
            <AdminButton className="mt-4" size="sm" onClick={() => claims.refetch()}>
              <RotateCcw /> Retry
            </AdminButton>
          </div>
        ) : null}

        {claims.data && claims.data.data.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Gavel className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 font-semibold">No claim matches these filters.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Claims opened by clients from their workspace land here.
            </p>
          </div>
        ) : null}

        {claims.data && claims.data.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="h-10 px-6 font-semibold">Claim</th>
                  <th className="h-10 px-3 font-semibold">Client → mover</th>
                  <th className="h-10 px-3 font-semibold">Category</th>
                  <th className="h-10 px-3 font-semibold">Priority</th>
                  <th className="h-10 px-3 font-semibold">Status</th>
                  <th className="h-10 px-6 text-right font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {claims.data.data.map((claim) => (
                  <tr
                    key={claim.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelected(claim.id)}
                  >
                    <td className="max-w-72 px-6 py-2.5">
                      <button
                        type="button"
                        className="block w-full truncate text-left font-semibold hover:underline"
                        onClick={() => setSelected(claim.id)}
                      >
                        {claim.subject}
                      </button>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {claim.reference}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {claim.client?.name ?? '—'}
                      <span className="block text-muted-foreground">
                        → {claim.mover?.name ?? 'no mover'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{CLAIM_CATEGORY_LABELS[claim.category]}</td>
                    <td className="px-3 py-2.5">
                      {claim.priority ? (
                        <AdminBadge variant={PRIORITY_VARIANT[claim.priority]}>
                          {CLAIM_PRIORITY_LABELS[claim.priority]}
                        </AdminBadge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <AdminBadge variant={STATUS_VARIANT[claim.status]}>
                        {CLAIM_STATUS_LABELS[claim.status]}
                      </AdminBadge>
                    </td>
                    <td className="whitespace-nowrap px-6 py-2.5 text-right text-muted-foreground">
                      {adminDate.format(new Date(claim.updatedAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {claims.data && claims.data.meta.pageCount > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Page {claims.data.meta.page} of {claims.data.meta.pageCount} ·{' '}
              {claims.data.meta.itemCount} claims
            </p>
            <div className="flex gap-2">
              <AdminButton
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft /> Previous
              </AdminButton>
              <AdminButton
                variant="outline"
                size="sm"
                disabled={!claims.data.meta.hasNextPage}
                onClick={() => setPage((value) => value + 1)}
              >
                Next <ChevronRight />
              </AdminButton>
            </div>
          </div>
        ) : null}
      </AdminCard>

      <ClaimSheet claimId={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
