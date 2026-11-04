'use client';

import { useEffect, useMemo, useState } from 'react';
import { Languages, Loader2, RefreshCcw, RotateCcw, Save, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { AdminBadge } from '@/components/ui/admin-badge';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { AdminInput } from '@/components/ui/admin-input';
import { AdminSelect } from '@/components/ui/admin-select';
import { useAdminContent, useResetContent, useSaveContent } from '@/hooks/content/admin';
import type { ContentEntryDto, ContentSectionDto, ServerErrorResponse } from '@/types';
import { useAdminShell } from '../shell/admin-shell-context';

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English (default site)' },
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
];

type Draft = Record<string, string>;

export function ContentPortal() {
  const { setPage: publishPage, clearPage, setFooter, clearFooter } = useAdminShell();
  const [locale, setLocale] = useState<'en' | 'fr' | 'ar'>('en');
  const [draft, setDraft] = useState<Draft>({});
  const content = useAdminContent(locale);
  const saveContent = useSaveContent();
  const resetContent = useResetContent();
  const [savingSection, setSavingSection] = useState<string | null>(null);

  useEffect(() => {
    publishPage({
      breadcrumbs: [{ label: 'Admin', href: '/admin' }, { label: 'Content' }],
      title: 'Content',
      description: 'Edit the public landing copy per locale. Saved values are served live.',
      actions: (
        <AdminSelect
          value={locale}
          onValueChange={(value) => setLocale(value as 'en' | 'fr' | 'ar')}
          options={LOCALE_OPTIONS}
          ariaLabel="Content locale"
        />
      ),
    });
    return () => {
      clearPage();
      clearFooter();
    };
  }, [clearFooter, clearPage, locale, publishPage]);

  // Hydrate the draft whenever the fetched bundle changes.
  useEffect(() => {
    if (!content.data) return;
    const next: Draft = {};
    for (const section of content.data.sections) {
      for (const entry of section.entries) next[entry.key] = entry.value;
    }
    setDraft(next);
  }, [content.data]);

  useEffect(() => {
    if (!content.data) {
      setFooter(<p className="text-xs text-muted-foreground">Loading content entries…</p>);
      return;
    }
    const overridden = content.data.sections.reduce(
      (count, section) => count + section.entries.filter((entry) => entry.overridden).length,
      0,
    );
    setFooter(
      <p className="text-xs text-muted-foreground">
        {content.data.sections.reduce((count, section) => count + section.entries.length, 0)}{' '}
        managed keys · {overridden} overridden in {content.data.locale.toUpperCase()} · unsaved
        edits are marked on each field
      </p>,
    );
    return clearFooter;
  }, [clearFooter, content.data, setFooter]);

  const dirtyKeys = useMemo(() => {
    if (!content.data) return new Set<string>();
    const dirty = new Set<string>();
    for (const section of content.data.sections) {
      for (const entry of section.entries) {
        if (draft[entry.key] !== undefined && draft[entry.key] !== entry.value) {
          dirty.add(entry.key);
        }
      }
    }
    return dirty;
  }, [content.data, draft]);

  const saveSection = (section: ContentSectionDto) => {
    setSavingSection(section.section);
    saveContent.mutate(
      {
        locale,
        entries: section.entries.map((entry) => ({
          key: entry.key,
          value: draft[entry.key] ?? entry.value,
        })),
      },
      {
        onSuccess: (result) => {
          toast.success(
            `${section.title} copy saved (${result.saved} keys, ${locale.toUpperCase()}).`,
          );
        },
        onError: (error) => toast.error(extractErrorMessage(error)),
        onSettled: () => setSavingSection(null),
      },
    );
  };

  const resetSection = (section: ContentSectionDto) => {
    setSavingSection(section.section);
    resetContent.mutate(
      { locale, keys: section.entries.map((entry) => entry.key) },
      {
        onSuccess: (result) => {
          toast.success(
            `${section.title} restored to the in-code defaults (${result.reset} keys).`,
          );
        },
        onError: (error) => toast.error(extractErrorMessage(error)),
        onSettled: () => setSavingSection(null),
      },
    );
  };

  return (
    <div className="p-4 min-[426px]:p-10">
      <div className="space-y-4">
        {content.isError ? (
          <AdminCard className="p-10 text-center">
            <TriangleAlert className="mx-auto size-5 text-destructive" />
            <p className="mt-3 font-semibold">Content could not be loaded.</p>
            <AdminButton className="mt-4" size="sm" onClick={() => content.refetch()}>
              <RefreshCcw /> Retry
            </AdminButton>
          </AdminCard>
        ) : null}

        {content.data
          ? content.data.sections.map((section) => (
              <SectionCard
                key={section.section}
                section={section}
                draft={draft}
                dirtyKeys={dirtyKeys}
                pending={savingSection === section.section}
                saving={saveContent.isPending || resetContent.isPending}
                onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))}
                onSave={() => saveSection(section)}
                onReset={() => resetSection(section)}
              />
            ))
          : null}

        {content.isPending && !content.data
          ? Array.from({ length: 3 }).map((_, index) => (
              <AdminCard key={index} className="p-6">
                <div className="h-5 w-40 animate-pulse rounded-md bg-muted" />
                <div className="mt-6 space-y-4">
                  <div className="h-9 animate-pulse rounded-md bg-muted" />
                  <div className="h-9 animate-pulse rounded-md bg-muted" />
                </div>
              </AdminCard>
            ))
          : null}
      </div>
    </div>
  );
}

function SectionCard({
  section,
  draft,
  dirtyKeys,
  pending,
  saving,
  onChange,
  onSave,
  onReset,
}: {
  section: ContentSectionDto;
  draft: Draft;
  dirtyKeys: Set<string>;
  pending: boolean;
  saving: boolean;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const sectionDirty = section.entries.some((entry) => dirtyKeys.has(entry.key));
  const anyPending = pending || saving;

  return (
    <AdminCard className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Languages className="size-4 text-primary" />
            {section.title}
            {sectionDirty ? <AdminBadge variant="secondary">Unsaved edits</AdminBadge> : null}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <AdminButton
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={anyPending}
            aria-label={`Restore ${section.title} defaults`}
          >
            {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Defaults
          </AdminButton>
          <AdminButton size="sm" onClick={onSave} disabled={anyPending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Save section
          </AdminButton>
        </div>
      </div>

      <div className="divide-y divide-border">
        {section.entries.map((entry) => (
          <EntryRow
            key={entry.key}
            entry={entry}
            value={draft[entry.key] ?? entry.value}
            dirty={dirtyKeys.has(entry.key)}
            onChange={(value) => onChange(entry.key, value)}
          />
        ))}
      </div>
    </AdminCard>
  );
}

function EntryRow({
  entry,
  value,
  dirty,
  onChange,
}: {
  entry: ContentEntryDto;
  value: string;
  dirty: boolean;
  onChange: (value: string) => void;
}) {
  const id = `content-${entry.key.replace(/[^a-z0-9]/gi, '-')}`;
  return (
    <div className="space-y-1.5 px-6 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="text-xs font-semibold">
          {entry.label}
        </label>
        <span className="mono text-[10px] text-muted-foreground">{entry.key}</span>
        {dirty ? (
          <AdminBadge>Unsaved</AdminBadge>
        ) : entry.overridden ? (
          <AdminBadge variant="secondary">Managed</AdminBadge>
        ) : entry.value !== entry.default && entry.value.length > 0 ? (
          <AdminBadge variant="secondary">Edited</AdminBadge>
        ) : (
          <AdminBadge variant="secondary">Default</AdminBadge>
        )}
      </div>
      {entry.multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          aria-label={entry.label}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      ) : (
        <AdminInput id={id} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}

function extractErrorMessage(error: unknown): string {
  const response = (error as AxiosError<ServerErrorResponse>).response?.data;
  return response?.message ?? 'The content could not be saved. Try again.';
}
