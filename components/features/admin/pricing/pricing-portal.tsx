'use client';

import { useEffect, useMemo, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  BadgeDollarSign,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Stamp,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { AdminBadge } from '@/components/ui/admin-badge';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { AdminDialog } from '@/components/ui/admin-dialog';
import { AdminInput } from '@/components/ui/admin-input';
import { AdminSelect } from '@/components/ui/admin-select';
import { useAdminPricing, useDeletePricingRule, useUpdatePricingRule } from '@/hooks/content/admin';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { PricingRuleDto, PricingStatus, ServerErrorResponse } from '@/types';
import { useAdminShell } from '../shell/admin-shell-context';
import { PricingFormSheet, type PricingFormMode } from './pricing-form-sheet';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'RETIRED', label: 'Retired' },
];

const money = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const dayFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

type SortField = 'name' | 'status' | 'createdAt' | 'baseFare';
type SortDirection = 'ASC' | 'DESC';

interface PricingFormState {
  mode: PricingFormMode;
  rule: PricingRuleDto | null;
}

export function PricingPortal() {
  const { setPage: publishPage, clearPage, setFooter, clearFooter } = useAdminShell();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [status, setStatus] = useState<PricingStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const limit = 10;
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('DESC');
  const [formState, setFormState] = useState<PricingFormState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PricingRuleDto | null>(null);

  const pricing = useAdminPricing({
    page,
    limit,
    search: debouncedSearch || undefined,
    status,
    sort: `${sortField},${sortDirection}`,
  });
  const updateRule = useUpdatePricingRule();
  const deleteRule = useDeletePricingRule();

  useEffect(() => {
    publishPage({
      breadcrumbs: [{ label: 'Admin', href: '/admin' }, { label: 'Pricing rules' }],
      title: 'Pricing rules',
      description: 'Tune base fares, distance and volume multipliers, and service surcharges.',
      actions: (
        <AdminButton size="sm" onClick={() => setFormState({ mode: 'create', rule: null })}>
          <Plus /> New rule
        </AdminButton>
      ),
    });
    return () => {
      clearPage();
      clearFooter();
    };
  }, [clearFooter, clearPage, publishPage]);

  useEffect(() => setPage(1), [debouncedSearch, status, sortField, sortDirection]);

  const footer = useMemo(() => {
    if (!pricing.data) {
      return <p className="text-xs text-muted-foreground">Loading rule pagination…</p>;
    }
    const meta = pricing.data.meta;
    return (
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {meta.itemCount} rules · page {meta.page} of {Math.max(1, meta.pageCount)}
        </p>
        <div className="flex items-center gap-2">
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            aria-label="Previous pricing page"
          >
            <ChevronLeft /> Previous
          </AdminButton>
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => current + 1)}
            disabled={!meta.hasNextPage}
            aria-label="Next pricing page"
          >
            Next <ChevronRight />
          </AdminButton>
        </div>
      </div>
    );
  }, [page, pricing.data]);

  useEffect(() => {
    setFooter(footer);
    return clearFooter;
  }, [clearFooter, footer, setFooter]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortField(field);
      setSortDirection('ASC');
    }
  };

  const changeStatus = (rule: PricingRuleDto, next: PricingStatus) => {
    if (rule.status === next) return;
    updateRule.mutate(
      { id: rule.id, payload: { status: next } },
      {
        onSuccess: (updated) => {
          toast.success(
            next === 'ACTIVE'
              ? `${updated.name} is now the active pricing rule. Other rules were retired.`
              : `${updated.name} was retired.`,
          );
        },
        onError: (error) => toast.error(extractErrorMessage(error)),
      },
    );
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteRule.mutate(pendingDelete.id, {
      onSuccess: (deleted) => {
        toast.success(`${deleted.name} was deleted.`);
        setPendingDelete(null);
      },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  };

  return (
    <div className="p-4 min-[426px]:p-10">
      <AdminCard className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BadgeDollarSign className="size-4 text-primary" />
            Rule registry · one active table at a time
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="pricing-search" className="sr-only">
              Search rules by name
            </label>
            <AdminInput
              id="pricing-search"
              placeholder="Search rules…"
              className="w-56"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <AdminSelect
              value={status}
              onValueChange={(value) => setStatus(value as PricingStatus | 'ALL')}
              options={STATUS_OPTIONS}
              ariaLabel="Filter by rule status"
            />
          </div>
        </div>

        <RuleTable
          rules={pricing}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={toggleSort}
          onEdit={(rule) => setFormState({ mode: 'edit', rule })}
          onActivate={(rule) => changeStatus(rule, 'ACTIVE')}
          onRetire={(rule) => changeStatus(rule, 'RETIRED')}
          onDelete={(rule) => setPendingDelete(rule)}
        />
      </AdminCard>

      <PricingFormSheet
        open={Boolean(formState)}
        mode={formState?.mode ?? 'create'}
        rule={formState?.rule ?? null}
        onClose={() => setFormState(null)}
      />

      <AdminDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && !deleteRule.isPending && setPendingDelete(null)}
        title="Delete this pricing rule?"
        description={`${pendingDelete?.name ?? 'This rule'} will be removed from the registry. Rules that were pointing at it keep their version history. This action cannot be undone from the back office.`}
        footer={
          <>
            <AdminButton
              variant="secondary"
              onClick={() => setPendingDelete(null)}
              disabled={deleteRule.isPending}
            >
              Cancel
            </AdminButton>
            <AdminButton
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteRule.isPending}
            >
              <Trash2 /> Delete rule
            </AdminButton>
          </>
        }
      />
    </div>
  );
}

function RuleTable({
  rules,
  sortField,
  sortDirection,
  onSort,
  onEdit,
  onActivate,
  onRetire,
  onDelete,
}: {
  rules: ReturnType<typeof useAdminPricing>;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onEdit: (rule: PricingRuleDto) => void;
  onActivate: (rule: PricingRuleDto) => void;
  onRetire: (rule: PricingRuleDto) => void;
  onDelete: (rule: PricingRuleDto) => void;
}) {
  if (rules.isError) {
    return (
      <div className="px-6 py-14 text-center">
        <CircleAlert className="mx-auto size-5 text-destructive" />
        <p className="mt-3 font-semibold">Pricing rules could not be loaded.</p>
        <AdminButton className="mt-4" size="sm" onClick={() => rules.refetch()}>
          <RotateCcw /> Retry
        </AdminButton>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-xs">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="h-10 px-6">
              <SortableHeader
                label="Rule"
                field="name"
                active={sortField}
                direction={sortDirection}
                onSort={onSort}
              />
            </th>
            <th className="h-10 px-3">
              <SortableHeader
                label="Base fare"
                field="baseFare"
                active={sortField}
                direction={sortDirection}
                onSort={onSort}
              />
            </th>
            <th className="h-10 px-3 font-semibold">Formula</th>
            <th className="h-10 px-3 font-semibold">Effective window</th>
            <th className="h-10 px-3">
              <SortableHeader
                label="Status"
                field="status"
                active={sortField}
                direction={sortDirection}
                onSort={onSort}
              />
            </th>
            <th className="h-10 px-3">
              <SortableHeader
                label="Updated"
                field="createdAt"
                active={sortField}
                direction={sortDirection}
                onSort={onSort}
              />
            </th>
            <th className="h-10 px-6 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rules.isPending
            ? Array.from({ length: 4 }).map((_, index) => (
                <tr key={index}>
                  <td colSpan={7} className="px-6 py-4">
                    <div className="h-5 animate-pulse rounded-md bg-muted" />
                  </td>
                </tr>
              ))
            : null}
          {rules.data && rules.data.data.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-14 text-center">
                <p className="font-semibold">No pricing rules yet.</p>
                <p className="mt-1 text-muted-foreground">
                  Create the first rule to make the quote estimator deterministic.
                </p>
              </td>
            </tr>
          ) : null}
          {rules.data?.data.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              onEdit={onEdit}
              onActivate={onActivate}
              onRetire={onRetire}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RuleRow({
  rule,
  onEdit,
  onActivate,
  onRetire,
  onDelete,
}: {
  rule: PricingRuleDto;
  onEdit: (rule: PricingRuleDto) => void;
  onActivate: (rule: PricingRuleDto) => void;
  onRetire: (rule: PricingRuleDto) => void;
  onDelete: (rule: PricingRuleDto) => void;
}) {
  return (
    <tr className="text-foreground">
      <td className="px-6 py-2.5">
        <span className="font-semibold">{rule.name}</span>
        <span className="block text-[10px] text-muted-foreground">v{rule.version}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 font-semibold">
        {money.format(rule.baseFare)} {rule.currency}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
        {rule.perKm.toFixed(3)} /km · {rule.perM3.toFixed(3)} /m³ · +{rule.expressSurcharge}%
        express · min {money.format(rule.minQuote)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
        {dayFormatter.format(new Date(rule.effectiveFrom))}
        {rule.effectiveTo ? ` → ${dayFormatter.format(new Date(rule.effectiveTo))}` : ' → open'}
      </td>
      <td className="px-3 py-2.5">
        <AdminBadge variant={rule.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {rule.status === 'ACTIVE' ? 'Active' : 'Retired'}
        </AdminBadge>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
        {dayFormatter.format(new Date(rule.updatedAt))}
      </td>
      <td className="px-6 py-2.5 text-right">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <AdminButton variant="ghost" size="iconSm" aria-label={`Actions for ${rule.name}`}>
              <MoreHorizontal />
            </AdminButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="z-[140] min-w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
            >
              <DropdownMenu.Item
                onSelect={() => onEdit(rule)}
                className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
              >
                <Pencil className="size-4" /> Edit rule
              </DropdownMenu.Item>
              {rule.status === 'ACTIVE' ? (
                <DropdownMenu.Item
                  onSelect={() => onRetire(rule)}
                  className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                >
                  <Stamp className="size-4" /> Retire rule
                </DropdownMenu.Item>
              ) : (
                <DropdownMenu.Item
                  onSelect={() => onActivate(rule)}
                  className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                >
                  <Check className="size-4" /> Make active
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={() => onDelete(rule)}
                className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm text-destructive outline-none data-[highlighted]:bg-destructive/10"
              >
                <Trash2 className="size-4" /> Delete rule
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </td>
    </tr>
  );
}

function SortableHeader({
  label,
  field,
  active,
  direction,
  onSort,
}: {
  label: string;
  field: SortField;
  active: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = active === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label={`Sort by ${label}`}
    >
      {label}
      <span className="text-[10px]">{isActive ? (direction === 'ASC' ? '▲' : '▼') : '↕'}</span>
    </button>
  );
}

function extractErrorMessage(error: unknown): string {
  const response = (error as AxiosError<ServerErrorResponse>).response?.data;
  return response?.message ?? 'The change could not be applied. Try again.';
}
