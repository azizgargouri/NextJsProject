'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Edit3,
  Eye,
  Loader2,
  MoreHorizontal,
  PackageOpen,
  Plus,
  RotateCcw,
  Search,
  ShieldBan,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { AdminBadge } from '@/components/ui/admin-badge';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminDialog } from '@/components/ui/admin-dialog';
import { AdminInput } from '@/components/ui/admin-input';
import { AdminSelect } from '@/components/ui/admin-select';
import { AdminSheet } from '@/components/ui/admin-sheet';
import { useAdminUsers, useDeleteAdminUser, useUserStatus } from '@/hooks/content/admin';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { useAdminI18n, type AdminMessages } from '@/lib/i18n/admin';
import { UserAvatar } from '@/components/ui/user-avatar';
import type { ResponseUserDto, ServerErrorResponse, UserRole, UserStatus } from '@/types';
import { useAdminShell } from '../shell/admin-shell-context';
import { UserFormSheet, type UserFormMode } from './user-form-sheet';

type SortField = 'name' | 'email' | 'role' | 'status' | 'createdAt';
type SortDirection = 'ASC' | 'DESC';
type ToggleColumn = 'phone' | 'role' | 'status' | 'createdAt';

interface PendingStatusChange {
  user: ResponseUserDto;
  status: UserStatus;
}

interface UserFormState {
  mode: UserFormMode;
  user: ResponseUserDto | null;
}

export function UsersPortal() {
  const { setPage: publishPage, clearPage, setFooter, clearFooter } = useAdminShell();
  const { m } = useAdminI18n();
  const roleOptions = (['ALL', 'CLIENT', 'MOVER', 'ADMIN'] as const).map((value) => ({
    value,
    label: m.common.rolesPlural[value],
  }));
  const statusOptions = (['ALL', 'ACTIVE', 'BLOCKED'] as const).map((value) => ({
    value,
    label: m.users.statusOptions[value],
  }));
  const currentUserId = useAuthStore((state) => state.user?.id);
  const updateCurrentProfile = useAuthStore((state) => state.updateProfile);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [role, setRole] = useState<UserRole | 'ALL'>('ALL');
  const [status, setStatus] = useState<UserStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('DESC');
  const [selectedUser, setSelectedUser] = useState<ResponseUserDto | null>(null);
  const [pendingStatus, setPendingStatus] = useState<PendingStatusChange | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ResponseUserDto | null>(null);
  const [userForm, setUserForm] = useState<UserFormState | null>(null);
  const [columns, setColumns] = useState<Record<ToggleColumn, boolean>>({
    phone: true,
    role: true,
    status: true,
    createdAt: true,
  });

  const users = useAdminUsers({
    page,
    limit,
    search: debouncedSearch || undefined,
    role,
    status,
    sort: `${sortField},${sortDirection}`,
  });
  const statusMutation = useUserStatus();
  const deleteMutation = useDeleteAdminUser();
  const openCreate = useCallback(() => setUserForm({ mode: 'create', user: null }), []);

  useEffect(() => {
    publishPage({
      breadcrumbs: [{ label: m.common.admin, href: '/admin' }, { label: m.users.title }],
      title: m.users.title,
      description: m.users.description,
      actions: (
        <AdminButton size="sm" onClick={openCreate}>
          <Plus /> {m.users.newAccount}
        </AdminButton>
      ),
    });
    return () => {
      clearPage();
      clearFooter();
    };
  }, [clearFooter, clearPage, m, openCreate, publishPage]);

  useEffect(() => setPage(1), [debouncedSearch, role, status, limit, sortField, sortDirection]);

  const footer = useMemo(() => {
    if (!users.data) {
      return <p className="text-xs text-muted-foreground">{m.users.loadingPagination}</p>;
    }
    return (
      <UsersPagination
        page={users.data.meta.page}
        pageCount={users.data.meta.pageCount}
        itemCount={users.data.meta.itemCount}
        limit={limit}
        onLimitChange={setLimit}
        onPageChange={setPage}
      />
    );
  }, [limit, m, users.data]);

  useEffect(() => {
    setFooter(footer);
    return clearFooter;
  }, [clearFooter, footer, setFooter]);

  const hasFilters = Boolean(search || role !== 'ALL' || status !== 'ALL');
  const resetFilters = () => {
    setSearch('');
    setRole('ALL');
    setStatus('ALL');
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortField(field);
      setSortDirection('ASC');
    }
  };

  const requestStatusChange = (user: ResponseUserDto) => {
    setPendingStatus({ user, status: user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE' });
  };

  const confirmStatusChange = () => {
    if (!pendingStatus) return;
    statusMutation.mutate(
      { id: pendingStatus.user.id, status: pendingStatus.status },
      {
        onSuccess: (updated) => {
          toast.success(
            updated.status === 'BLOCKED'
              ? m.users.deactivated(updated.name)
              : m.users.activated(updated.name),
          );
          if (selectedUser?.id === updated.id) setSelectedUser(updated);
          setPendingStatus(null);
        },
        onError: (error) => toast.error(extractErrorMessage(error, m.users.updateFailed)),
      },
    );
  };

  const openEdit = (user: ResponseUserDto) => {
    setSelectedUser(null);
    setUserForm({ mode: 'edit', user });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteMutation.mutate(pendingDelete.id, {
      onSuccess: (deleted) => {
        toast.success(m.users.deleted(deleted.name));
        setSelectedUser(null);
        setPendingDelete(null);
      },
      onError: (error) => toast.error(extractErrorMessage(error, m.users.updateFailed)),
    });
  };

  return (
    <div className="flex min-h-full flex-col p-4 min-[426px]:p-10">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <AdminInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={m.users.searchPlaceholder}
              aria-label={m.users.searchLabel}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminSelect
              value={role}
              onValueChange={(value) => setRole(value as UserRole | 'ALL')}
              options={roleOptions}
              ariaLabel={m.users.filterRole}
              className="min-w-32 flex-1 sm:flex-none"
            />
            <AdminSelect
              value={status}
              onValueChange={(value) => setStatus(value as UserStatus | 'ALL')}
              options={statusOptions}
              ariaLabel={m.users.filterStatus}
              className="min-w-32 flex-1 sm:flex-none"
            />
            {hasFilters ? (
              <AdminButton variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw /> {m.common.reset}
              </AdminButton>
            ) : null}
            <ColumnMenu columns={columns} setColumns={setColumns} />
          </div>
        </div>

        <div className="relative min-h-[360px] flex-1 overflow-auto">
          {users.isFetching ? (
            <div className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-primary/20">
              <span className="block h-full w-1/3 animate-pulse bg-primary" />
            </div>
          ) : null}
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-muted text-muted-foreground shadow-[0_1px_0_var(--border)]">
              <tr>
                <SortableHeader
                  label={m.users.columns.account}
                  field="name"
                  activeField={sortField}
                  direction={sortDirection}
                  onSort={toggleSort}
                />
                {columns.phone ? (
                  <th className="h-10 px-3 font-semibold">{m.users.columns.phone}</th>
                ) : null}
                {columns.role ? (
                  <SortableHeader
                    label={m.users.columns.role}
                    field="role"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={toggleSort}
                  />
                ) : null}
                {columns.status ? (
                  <SortableHeader
                    label={m.users.columns.status}
                    field="status"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={toggleSort}
                  />
                ) : null}
                {columns.createdAt ? (
                  <SortableHeader
                    label={m.users.columns.joined}
                    field="createdAt"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={toggleSort}
                  />
                ) : null}
                <th className="h-10 w-14 px-3 text-right font-semibold">{m.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.isPending ? <LoadingRows colSpan={visibleColumnCount(columns)} /> : null}
              {users.isError ? (
                <tr>
                  <td colSpan={visibleColumnCount(columns)} className="h-52 px-4 text-center">
                    <p className="font-semibold">{m.users.loadFailed}</p>
                    <p className="mt-1 text-muted-foreground">{m.users.loadFailedBody}</p>
                    <AdminButton className="mt-4" size="sm" onClick={() => users.refetch()}>
                      {m.common.retry}
                    </AdminButton>
                  </td>
                </tr>
              ) : null}
              {!users.isPending && !users.isError && users.data?.data.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnCount(columns)} className="h-64 px-4 text-center">
                    <PackageOpen className="mx-auto size-8 text-muted-foreground" />
                    <p className="mt-3 font-semibold">{m.users.empty}</p>
                    <p className="mt-1 text-muted-foreground">{m.users.emptyBody}</p>
                  </td>
                </tr>
              ) : null}
              {users.data?.data.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  columns={columns}
                  isSelf={user.id === currentUserId}
                  onView={() => setSelectedUser(user)}
                  onEdit={() => openEdit(user)}
                  onStatusChange={() => requestStatusChange(user)}
                  onDelete={() => setPendingDelete(user)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <UserDetailsSheet
        user={selectedUser}
        isSelf={selectedUser?.id === currentUserId}
        onClose={() => setSelectedUser(null)}
        onEdit={() => selectedUser && openEdit(selectedUser)}
        onStatusChange={() => selectedUser && requestStatusChange(selectedUser)}
        onDelete={() => selectedUser && setPendingDelete(selectedUser)}
      />

      <UserFormSheet
        open={Boolean(userForm)}
        mode={userForm?.mode ?? 'create'}
        user={userForm?.user ?? null}
        isSelf={userForm?.user?.id === currentUserId}
        onClose={() => setUserForm(null)}
        onSaved={(saved) => {
          setUserForm(null);
          if (saved.id === currentUserId) updateCurrentProfile(saved);
          if (selectedUser?.id === saved.id) setSelectedUser(saved);
        }}
      />

      <AdminDialog
        open={Boolean(pendingStatus)}
        onOpenChange={(open) => !open && !statusMutation.isPending && setPendingStatus(null)}
        title={
          pendingStatus?.status === 'BLOCKED' ? m.users.deactivateTitle : m.users.activateTitle
        }
        description={
          pendingStatus?.status === 'BLOCKED'
            ? m.users.deactivateBody(pendingStatus.user.name)
            : m.users.activateBody(pendingStatus?.user.name ?? m.users.thisUser)
        }
        footer={
          <>
            <AdminButton
              variant="secondary"
              onClick={() => setPendingStatus(null)}
              disabled={statusMutation.isPending}
            >
              {m.common.cancel}
            </AdminButton>
            <AdminButton
              variant={pendingStatus?.status === 'BLOCKED' ? 'destructive' : 'default'}
              onClick={confirmStatusChange}
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending ? <Loader2 className="animate-spin" /> : null}
              {pendingStatus?.status === 'BLOCKED'
                ? m.users.deactivateAccount
                : m.users.activateAccount}
            </AdminButton>
          </>
        }
      />

      <AdminDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && !deleteMutation.isPending && setPendingDelete(null)}
        title={m.users.deleteTitle}
        description={m.users.deleteBody(pendingDelete?.name ?? m.users.thisUser)}
        footer={
          <>
            <AdminButton
              variant="secondary"
              onClick={() => setPendingDelete(null)}
              disabled={deleteMutation.isPending}
            >
              {m.common.cancel}
            </AdminButton>
            <AdminButton
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {m.users.deleteAccount}
            </AdminButton>
          </>
        }
      />
    </div>
  );
}

function UserRow({
  user,
  columns,
  isSelf,
  onView,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  user: ResponseUserDto;
  columns: Record<ToggleColumn, boolean>;
  isSelf: boolean;
  onView: () => void;
  onEdit: () => void;
  onStatusChange: () => void;
  onDelete: () => void;
}) {
  const { m, fmt } = useAdminI18n();
  return (
    <tr className="transition-colors hover:bg-muted/50">
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={onView}
          className="flex max-w-72 items-center gap-3 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">{user.name}</span>
            <span className="block truncate text-muted-foreground">{user.email}</span>
          </span>
        </button>
      </td>
      {columns.phone ? <td className="whitespace-nowrap px-3 py-2">{user.phone}</td> : null}
      {columns.role ? (
        <td className="px-3 py-2">
          <AdminBadge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
            {m.common.roles[user.role]}
          </AdminBadge>
        </td>
      ) : null}
      {columns.status ? (
        <td className="px-3 py-2">
          <AdminBadge variant={user.status === 'ACTIVE' ? 'success' : 'destructive'}>
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
            {m.common.accountStatus[user.status]}
          </AdminBadge>
        </td>
      ) : null}
      {columns.createdAt ? (
        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
          {fmt.date(user.createdAt)}
        </td>
      ) : null}
      <td className="px-3 py-2 text-right">
        <UserActions
          user={user}
          isSelf={isSelf}
          onView={onView}
          onEdit={onEdit}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}

function UserActions({
  user,
  isSelf,
  onView,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  user: ResponseUserDto;
  isSelf: boolean;
  onView: () => void;
  onEdit: () => void;
  onStatusChange: () => void;
  onDelete: () => void;
}) {
  const { m } = useAdminI18n();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <AdminButton variant="ghost" size="iconSm" aria-label={m.common.actionsFor(user.name)}>
          <MoreHorizontal />
        </AdminButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-[120] min-w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <DropdownMenu.Item
            onSelect={onView}
            className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
          >
            <Eye className="size-4" /> {m.users.viewAccount}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onEdit}
            className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
          >
            <Edit3 className="size-4" /> {m.users.editAccount}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={isSelf}
            onSelect={onStatusChange}
            className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
          >
            {user.status === 'ACTIVE' ? (
              <ShieldBan className="size-4" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            {user.status === 'ACTIVE' ? m.users.deactivateAccount : m.users.activateAccount}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            disabled={isSelf}
            onSelect={onDelete}
            className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm text-destructive outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-destructive/10"
          >
            <Trash2 className="size-4" /> {m.users.deleteAccount}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function SortableHeader({
  label,
  field,
  activeField,
  direction,
  onSort,
}: {
  label: string;
  field: SortField;
  activeField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const { m } = useAdminI18n();
  const Icon = activeField !== field ? ArrowUpDown : direction === 'ASC' ? ArrowUp : ArrowDown;
  return (
    <th
      className="h-10 px-3 font-semibold"
      aria-sort={
        activeField === field ? (direction === 'ASC' ? 'ascending' : 'descending') : 'none'
      }
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        aria-label={m.common.sortBy(label)}
        className="inline-flex h-8 items-center gap-1 rounded-md px-1 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {label} <Icon className="size-3.5" />
      </button>
    </th>
  );
}

function ColumnMenu({
  columns,
  setColumns,
}: {
  columns: Record<ToggleColumn, boolean>;
  setColumns: React.Dispatch<React.SetStateAction<Record<ToggleColumn, boolean>>>;
}) {
  const { m } = useAdminI18n();
  const labels: Record<ToggleColumn, string> = {
    phone: m.users.columns.phone,
    role: m.users.columns.role,
    status: m.users.columns.status,
    createdAt: m.users.columns.joinedDate,
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <AdminButton variant="outline" size="icon" aria-label={m.users.chooseColumns}>
          <Columns3 />
        </AdminButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-[120] min-w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            {m.users.visibleColumns}
          </p>
          {(Object.keys(columns) as ToggleColumn[]).map((column) => (
            <DropdownMenu.CheckboxItem
              key={column}
              checked={columns[column]}
              onCheckedChange={(checked) =>
                setColumns((current) => ({ ...current, [column]: checked === true }))
              }
              className="relative flex h-8 cursor-default select-none items-center rounded-md py-1 pl-8 pr-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
            >
              <span className="absolute left-2 flex size-4 items-center justify-center">
                <DropdownMenu.ItemIndicator>
                  <Check className="size-4" />
                </DropdownMenu.ItemIndicator>
              </span>
              {labels[column]}
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function UserDetailsSheet({
  user,
  isSelf,
  onClose,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  user: ResponseUserDto | null;
  isSelf: boolean;
  onClose: () => void;
  onEdit: () => void;
  onStatusChange: () => void;
  onDelete: () => void;
}) {
  const { m, fmt } = useAdminI18n();
  return (
    <AdminSheet
      open={Boolean(user)}
      onOpenChange={(open) => !open && onClose()}
      title={user?.name ?? m.users.detailsTitle}
      description={m.users.detailsBody}
      footer={
        user ? (
          <>
            <AdminButton variant="secondary" onClick={onClose}>
              {m.common.close}
            </AdminButton>
            <AdminButton onClick={onEdit}>
              <Edit3 /> {m.users.editAccount}
            </AdminButton>
          </>
        ) : null
      }
    >
      {user ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="md" />
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <dl className="divide-y divide-border rounded-lg border border-border">
            <DetailRow label={m.users.details.role} value={m.common.roles[user.role]} />
            <DetailRow label={m.users.details.status} value={m.common.accountStatus[user.status]} />
            <DetailRow label={m.users.details.phone} value={user.phone} />
            <DetailRow label={m.users.details.locale} value={localeName(m, user.locale)} />
            <DetailRow label={m.users.details.created} value={fmt.dateTime(user.createdAt)} />
            <DetailRow label={m.users.details.updated} value={fmt.dateTime(user.updatedAt)} />
            <DetailRow label={m.users.details.id} value={user.id} mono />
          </dl>
          {isSelf ? (
            <p className="rounded-md bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
              {m.users.selfNote}
            </p>
          ) : null}
          <div className="border-t border-border pt-5">
            <h3 className="text-sm font-semibold">{m.users.access}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{m.users.accessBody}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <AdminButton
                variant={user.status === 'ACTIVE' ? 'outline' : 'default'}
                size="sm"
                onClick={onStatusChange}
                disabled={isSelf}
                title={isSelf ? m.users.cannotDeactivateSelf : undefined}
              >
                {user.status === 'ACTIVE' ? <ShieldBan /> : <ShieldCheck />}
                {user.status === 'ACTIVE' ? m.users.deactivate : m.users.activate}
              </AdminButton>
              <AdminButton
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={isSelf}
                title={isSelf ? m.users.cannotDeleteSelf : undefined}
              >
                <Trash2 /> {m.users.deleteAccount}
              </AdminButton>
            </div>
          </div>
        </div>
      ) : null}
    </AdminSheet>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-4 px-3 py-3 text-sm">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className={mono ? 'break-all font-mono text-xs' : 'break-words'}>{value}</dd>
    </div>
  );
}

function UsersPagination({
  page,
  pageCount,
  itemCount,
  limit,
  onLimitChange,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  itemCount: number;
  limit: number;
  onLimitChange: (limit: number) => void;
  onPageChange: (page: number) => void;
}) {
  const { m } = useAdminI18n();
  const safePageCount = Math.max(pageCount, 1);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{m.users.accountCount(itemCount)}</span>
        <div className="flex items-center gap-1">
          <span>{m.users.rows}</span>
          {[10, 25, 50].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => onLimitChange(size)}
              className="h-7 min-w-7 rounded-md px-1.5 outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
              data-active={limit === size}
              aria-pressed={limit === size}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className="mr-2 text-xs text-muted-foreground">
          {m.common.pageOf(page, safePageCount)}
        </span>
        <PaginationButton
          label={m.common.firstPage}
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
        >
          <ChevronFirst />
        </PaginationButton>
        <PaginationButton
          label={m.common.previousPage}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </PaginationButton>
        <PaginationButton
          label={m.common.nextPage}
          disabled={page >= safePageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </PaginationButton>
        <PaginationButton
          label={m.common.lastPage}
          disabled={page >= safePageCount}
          onClick={() => onPageChange(safePageCount)}
        >
          <ChevronLast />
        </PaginationButton>
      </div>
    </div>
  );
}

function PaginationButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <AdminButton
      variant="outline"
      size="iconSm"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </AdminButton>
  );
}

function LoadingRows({ colSpan }: { colSpan: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <tr key={index}>
          <td colSpan={colSpan} className="px-3 py-3">
            <div className="h-8 animate-pulse rounded-md bg-muted" />
          </td>
        </tr>
      ))}
    </>
  );
}

function visibleColumnCount(columns: Record<ToggleColumn, boolean>) {
  return 2 + Object.values(columns).filter(Boolean).length;
}

function localeName(m: AdminMessages, locale: string) {
  return locale in m.languages ? m.languages[locale as keyof AdminMessages['languages']] : locale;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<ServerErrorResponse>;
  return axiosError.response?.data?.message ?? fallback;
}
