'use client';

import { useEffect, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  HardDrive,
  Loader2,
  MoreHorizontal,
  PackageOpen,
  RefreshCcw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminBadge } from '@/components/ui/admin-badge';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { AdminDialog } from '@/components/ui/admin-dialog';
import { AdminSelect } from '@/components/ui/admin-select';
import { AdminSkeleton } from '@/components/ui/admin-skeleton';
import {
  useAdminStorageObjects,
  useAdminStorageStatus,
  useDeleteStorageObject,
} from '@/hooks/content/admin';
import { api } from '@/lib/api';
import { useAdminI18n } from '@/lib/i18n/admin';
import type { StorageObjectDto } from '@/types';
import { useAdminShell } from '../shell/admin-shell-context';

const PAGE_SIZE = 25;

export function StoragePortal() {
  const { setPage, clearPage, setFooter, clearFooter } = useAdminShell();
  const status = useAdminStorageStatus();
  const { m, fmt } = useAdminI18n();
  const folderOptions = [
    { value: 'ALL', label: m.storage.allFolders },
    { value: 'avatars/', label: 'avatars/' },
  ];
  const [folder, setFolder] = useState('ALL');
  // Cursor stack: index 0 is the first page (no cursor).
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors[cursors.length - 1];
  const objects = useAdminStorageObjects({
    prefix: folder === 'ALL' ? undefined : folder,
    cursor,
    limit: PAGE_SIZE,
  });
  const remove = useDeleteStorageObject();
  const [pendingDelete, setPendingDelete] = useState<StorageObjectDto | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const refetchStatus = status.refetch;
  const refetchObjects = objects.refetch;

  useEffect(() => {
    setPage({
      breadcrumbs: [{ label: m.common.admin, href: '/admin' }, { label: m.storage.title }],
      title: m.storage.title,
      description: m.storage.description,
      actions: (
        <AdminButton
          size="sm"
          variant="outline"
          onClick={() => {
            void refetchStatus();
            void refetchObjects();
          }}
        >
          <RefreshCcw />
          {m.storage.refresh}
        </AdminButton>
      ),
    });
    return () => clearPage();
  }, [clearPage, m, refetchObjects, refetchStatus, setPage]);

  useEffect(() => {
    const count = objects.data?.data.length ?? 0;
    setFooter(
      <div className="flex w-full items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          {m.storage.pageFooter(cursors.length, count)}
        </p>
        <div className="flex items-center gap-1">
          <AdminButton
            size="iconSm"
            variant="ghost"
            aria-label={m.common.previousPage}
            disabled={cursors.length === 1 || objects.isFetching}
            onClick={() => setCursors((stack) => stack.slice(0, -1))}
          >
            <ChevronLeft />
          </AdminButton>
          <AdminButton
            size="iconSm"
            variant="ghost"
            aria-label={m.common.nextPage}
            disabled={!objects.data?.nextCursor || objects.isFetching}
            onClick={() => {
              const next = objects.data?.nextCursor;
              if (next) setCursors((stack) => [...stack, next]);
            }}
          >
            <ChevronRight />
          </AdminButton>
        </div>
      </div>,
    );
    return clearFooter;
  }, [clearFooter, cursors.length, m, objects.data, objects.isFetching, setFooter]);

  const download = async (object: StorageObjectDto) => {
    setDownloading(object.key);
    try {
      const blob = await api.admin.downloadStorageObject(object.key);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = object.key.split('/').pop() ?? 'object';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(m.storage.downloadFailed);
    } finally {
      setDownloading(null);
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    remove.mutate(pendingDelete.key, {
      onSuccess: (result) => {
        toast.success(result.detachedUserId ? m.storage.deletedDetached : m.storage.deleted);
        setPendingDelete(null);
      },
      onError: () => toast.error(m.storage.deleteFailed),
    });
  };

  return (
    <div className="space-y-6 p-4 min-[426px]:p-10">
      <StatusPanel status={status} />

      <AdminCard className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">{m.storage.objects}</p>
          <AdminSelect
            value={folder}
            onValueChange={(value) => {
              setFolder(value);
              setCursors([undefined]);
            }}
            options={folderOptions}
            ariaLabel={m.storage.folder}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="h-10 px-3 font-semibold">{m.storage.columns.key}</th>
                <th className="h-10 px-3 font-semibold">{m.storage.columns.owner}</th>
                <th className="h-10 px-3 font-semibold">{m.storage.columns.size}</th>
                <th className="h-10 px-3 font-semibold">{m.storage.columns.modified}</th>
                <th className="h-10 px-3 font-semibold">{m.storage.columns.usage}</th>
                <th className="h-10 w-14 px-3 text-right font-semibold">{m.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {objects.isPending ? (
                Array.from({ length: 4 }, (_, index) => (
                  <tr key={index}>
                    <td colSpan={6} className="px-3 py-3">
                      <AdminSkeleton className="h-6" />
                    </td>
                  </tr>
                ))
              ) : objects.isError ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center">
                    <CircleAlert className="mx-auto size-5 text-destructive" />
                    <p className="mt-2 font-semibold">{m.storage.listFailed}</p>
                    <p className="mt-1 text-muted-foreground">{m.storage.listFailedBody}</p>
                    <AdminButton className="mt-3" size="sm" onClick={() => objects.refetch()}>
                      {m.common.retry}
                    </AdminButton>
                  </td>
                </tr>
              ) : objects.data.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center">
                    <PackageOpen className="mx-auto size-5 text-muted-foreground" />
                    <p className="mt-2 font-semibold">{m.storage.empty}</p>
                    <p className="mt-1 text-muted-foreground">{m.storage.emptyBody}</p>
                  </td>
                </tr>
              ) : (
                objects.data.data.map((object) => (
                  <tr key={object.key} className="hover:bg-muted/50">
                    <td className="max-w-80 px-3 py-3">
                      <span className="block truncate font-mono text-[11px]" title={object.key}>
                        {object.key}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {object.owner ? (
                        <span>
                          <span className="block font-medium">{object.owner.name}</span>
                          <span className="block text-muted-foreground">{object.owner.email}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{m.storage.noOwner}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{fmt.bytes(object.size)}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {object.lastModified ? fmt.dateTime(object.lastModified) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      {object.referenced ? (
                        <AdminBadge variant="success">{m.storage.inUse}</AdminBadge>
                      ) : (
                        <AdminBadge variant="outline">{m.storage.unreferenced}</AdminBadge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <AdminButton
                            size="iconSm"
                            variant="ghost"
                            aria-label={m.common.actionsFor(object.key)}
                          >
                            {downloading === object.key ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <MoreHorizontal />
                            )}
                          </AdminButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            align="end"
                            sideOffset={4}
                            className="z-[120] min-w-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
                          >
                            <DropdownMenu.Item
                              onSelect={() => void download(object)}
                              className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm outline-none data-[highlighted]:bg-accent"
                            >
                              <Download className="size-4" />
                              {m.storage.download}
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator className="my-1 h-px bg-border" />
                            <DropdownMenu.Item
                              onSelect={() => setPendingDelete(object)}
                              className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm text-destructive outline-none data-[highlighted]:bg-destructive/10"
                            >
                              <Trash2 className="size-4" />
                              {m.storage.delete}
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <AdminDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && !remove.isPending && setPendingDelete(null)}
        title={m.storage.deleteTitle}
        description={
          pendingDelete?.referenced && pendingDelete.owner
            ? m.storage.deleteReferenced(pendingDelete.owner.name)
            : m.storage.deleteBody
        }
        footer={
          <>
            <AdminButton
              variant="secondary"
              onClick={() => setPendingDelete(null)}
              disabled={remove.isPending}
            >
              {m.common.cancel}
            </AdminButton>
            <AdminButton variant="destructive" onClick={confirmDelete} disabled={remove.isPending}>
              {remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {m.storage.deleteFile}
            </AdminButton>
          </>
        }
      >
        {pendingDelete ? (
          <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-[11px]">
            {pendingDelete.key}
          </p>
        ) : null}
      </AdminDialog>
    </div>
  );
}

function StatusPanel({ status }: { status: ReturnType<typeof useAdminStorageStatus> }) {
  const { m, fmt } = useAdminI18n();
  if (status.isPending) return <AdminSkeleton className="h-28" />;

  if (status.isError || !status.data) {
    return (
      <AdminCard className="p-6">
        <CircleAlert className="size-5 text-destructive" />
        <h2 className="mt-3 text-base font-semibold">{m.storage.notConfigured}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{m.storage.notConfiguredBody}</p>
      </AdminCard>
    );
  }

  const { reachable, bucket, endpoint, objectCount, totalBytes, prefixes } = status.data;
  return (
    <AdminCard className="overflow-hidden">
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <HardDrive className="size-4 text-primary" />
            {m.storage.bucket} <span className="font-mono">{bucket}</span>
            {reachable ? (
              <AdminBadge variant="success">{m.storage.reachable}</AdminBadge>
            ) : (
              <AdminBadge variant="destructive">{m.storage.unreachable}</AdminBadge>
            )}
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{endpoint}</p>
          {!reachable ? (
            <p className="mt-2 text-sm text-muted-foreground">{m.storage.unreachableBody}</p>
          ) : null}
        </div>
        {reachable ? (
          <div className="sm:text-right">
            <p className="text-3xl font-bold tracking-[-0.03em]">{fmt.bytes(totalBytes ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{m.storage.stored(objectCount ?? 0)}</p>
          </div>
        ) : null}
      </div>
      {reachable && prefixes.length > 0 ? (
        <div className="grid divide-y divide-border border-t border-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {prefixes.map((prefix) => (
            <div key={prefix.prefix} className="px-6 py-4">
              <p className="font-mono text-xs font-semibold">{prefix.prefix}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {m.storage.files(prefix.objectCount, fmt.bytes(prefix.totalBytes))}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </AdminCard>
  );
}
