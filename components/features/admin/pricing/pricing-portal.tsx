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
import { useAdminI18n } from '@/lib/i18n/admin';
import type { PricingRuleDto, PricingStatus, ServerErrorResponse } from '@/types';
import { useAdminShell } from '../shell/admin-shell-context';
import { PricingFormSheet, type PricingFormMode } from './pricing-form-sheet';

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
  const { m } = useAdminI18n();
  const statusOptions = (['ALL', 'ACTIVE', 'RETIRED'] as const).map((value) => ({
    value,
    label: m.pricing.statusOptions[value],
  }));

  useEffect(() => {
    publishPage({
      breadcrumbs: [{ label: m.common.admin, href: '/admin' }, { label: m.pricing.title }],
      title: m.pricing.title,
      description: m.pricing.description,
      actions: (
        <AdminButton size="sm" onClick={() => setFormState({ mode: 'create', rule: null })}>
          <Plus /> {m.pricing.newRule}
        </AdminButton>
      ),
    });
    return () => {
      clearPage();
      clearFooter();
    };
  }, [clearFooter, clearPage, m, publishPage]);

  useEffect(() => setPage(1), [debouncedSearch, status, sortField, sortDirection]);

  const footer = useMemo(() => {
    if (!pricing.data) {
      return <p className="text-xs text-muted-foreground">{m.pricing.loadingPagination}</p>;
    }
    const meta = pricing.data.meta;
    return (
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {m.pricing.footer(meta.itemCount, meta.page, Math.max(1, meta.pageCount))}
        </p>
        <div className="flex items-center gap-2">
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            aria-label={m.pricing.previousPage}
          >
            <ChevronLeft /> {m.common.previous}
          </AdminButton>
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => current + 1)}
            disabled={!meta.hasNextPage}
            aria-label={m.pricing.nextPage}
          >
            {m.common.next} <ChevronRight />
          </AdminButton>
        </div>
      </div>
    );
  }, [m, page, pricing.data]);

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
            next === 'ACTIVE' ? m.pricing.activated(updated.name) : m.pricing.retired(updated.name),
          );
        },
        onError: (error) => toast.error(extractErrorMessage(error, m.pricing.changeFailed)),
      },
    );
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteRule.mutate(pendingDelete.id, {
      onSuccess: (deleted) => {
        toast.success(m.pricing.deleted(deleted.name));
        setPendingDelete(null);
      },
      onError: (error) => toast.error(extractErrorMessage(error, m.pricing.changeFailed)),
    });
  };

  return (
    <div className="p-4 min-[426px]:p-10">
      <AdminCard className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BadgeDollarSign className="size-4 text-primary" />
            {m.pricing.registry}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="pricing-search" className="sr-only">
              {m.pricing.searchLabel}
            </label>
            <AdminInput
              id="pricing-search"
              placeholder={m.pricing.searchPlaceholder}
              className="w-56"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <AdminSelect
              value={status}
              onValueChange={(value) => setStatus(value as PricingStatus | 'ALL')}
              options={statusOptions}
              ariaLabel={m.pricing.filterStatus}
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
        title={m.pricing.deleteTitle}
        description={m.pricing.deleteBody(pendingDelete?.name ?? m.pricing.thisRule)}
        footer={
          <>
            <AdminButton
              variant="secondary"
              onClick={() => setPendingDelete(null)}
              disabled={deleteRule.isPending}
            >
              {m.common.cancel}
            </AdminButton>
            <AdminButton
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteRule.isPending}
            >
              <Trash2 /> {m.pricing.deleteRule}
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
  const { m } = useAdminI18n();
  if (rules.isError) {
    return (
      <div className="px-6 py-14 text-center">
        <CircleAlert className="mx-auto size-5 text-destructive" />
        <p className="mt-3 font-semibold">{m.pricing.loadFailed}</p>
        <AdminButton className="mt-4" size="sm" onClick={() => rules.refetch()}>
          <RotateCcw /> {m.common.retry}
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
                label={m.pricing.columns.rule}
                field="name"
                active={sortField}
                direction={sortDirection}
                onSort={onSort}
              />
            </th>
            <th className="h-10 px-3">
              <SortableHeader
                label={m.pricing.columns.baseFare}
                field="baseFare"
                active={sortField}
                direction={sortDirection}
                onSort={onSort}
              />
            </th>
            <th className="h-10 px-3 font-semibold">{m.pricing.columns.formula}</th>
            <th className="h-10 px-3 font-semibold">{m.pricing.columns.window}</th>
            <th className="h-10 px-3">
              <SortableHeader
                label={m.pricing.columns.status}
                field="status"
                active={sortField}
                direction={sortDirection}
                onSort={onSort}
              />
            </th>
            <th className="h-10 px-3">
              <SortableHeader
                label={m.pricing.columns.updated}
                field="createdAt"
                active={sortField}
                direction={sortDirection}
                onSort={onSort}
              />
            </th>
            <th className="h-10 px-6 text-right font-semibold">{m.common.actions}</th>
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
                <p className="font-semibold">{m.pricing.empty}</p>
                <p className="mt-1 text-muted-foreground">{m.pricing.emptyBody}</p>
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
  const { m, fmt } = useAdminI18n();
  return (
    <tr className="text-foreground">
      <td className="px-6 py-2.5">
        <span className="font-semibold">{rule.name}</span>
        <span className="block text-[10px] text-muted-foreground">v{rule.version}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 font-semibold">
        {fmt.money(rule.baseFare)} {rule.currency}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
        {m.pricing.formula(
          fmt.money(rule.perKm),
          fmt.money(rule.perM3),
          rule.expressSurcharge,
          fmt.money(rule.minQuote),
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
        {fmt.date(rule.effectiveFrom)}
        {` → ${rule.effectiveTo ? fmt.date(rule.effectiveTo) : m.pricing.open}`}
      </td>
      <td className="px-3 py-2.5">
        <AdminBadge variant={rule.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {m.pricing.status[rule.status]}
        </AdminBadge>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
        {fmt.date(rule.updatedAt)}
      </td>
      <td className="px-6 py-2.5 text-right">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <AdminButton variant="ghost" size="iconSm" aria-label={m.common.actionsFor(rule.name)}>
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
                <Pencil className="size-4" /> {m.pricing.editRule}
              </DropdownMenu.Item>
              {rule.status === 'ACTIVE' ? (
                <DropdownMenu.Item
                  onSelect={() => onRetire(rule)}
                  className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                >
                  <Stamp className="size-4" /> {m.pricing.retireRule}
                </DropdownMenu.Item>
              ) : (
                <DropdownMenu.Item
                  onSelect={() => onActivate(rule)}
                  className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                >
                  <Check className="size-4" /> {m.pricing.makeActive}
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={() => onDelete(rule)}
                className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm text-destructive outline-none data-[highlighted]:bg-destructive/10"
              >
                <Trash2 className="size-4" /> {m.pricing.deleteRule}
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
  const { m } = useAdminI18n();
  const isActive = active === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label={m.common.sortBy(label)}
    >
      {label}
      <span className="text-[10px]">{isActive ? (direction === 'ASC' ? '▲' : '▼') : '↕'}</span>
    </button>
  );
}

function extractErrorMessage(error: unknown, fallback: string): string {
  const response = (error as AxiosError<ServerErrorResponse>).response?.data;
  return response?.message ?? fallback;
}
