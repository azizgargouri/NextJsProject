'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from 'next-themes';
import {
  CircleAlert,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  MonitorSmartphone,
  Moon,
  Sun,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminBadge } from '@/components/ui/admin-badge';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { AdminDialog } from '@/components/ui/admin-dialog';
import { AdminInput } from '@/components/ui/admin-input';
import { AdminSkeleton } from '@/components/ui/admin-skeleton';
import {
  useAccountSessions,
  useChangePassword,
  useRevokeOtherSessions,
  useRevokeSession,
} from '@/hooks/content/account';
import { ADMIN_LOCALES, useAdminI18n, type AdminMessages } from '@/lib/i18n/admin';
import { cn } from '@/lib/utils';
import type { AccountSessionDto } from '@/types';
import { useAdminShell } from '../shell/admin-shell-context';
import { AccountField, readServerError } from './account-field';

function buildPasswordSchema(m: AdminMessages) {
  const e = m.settings.errors;
  return z
    .object({
      currentPassword: z.string().min(1, e.current),
      newPassword: z.string().min(8, e.min).regex(/[A-Z]/, e.upper).regex(/[0-9]/, e.digit),
      confirmPassword: z.string().min(1, e.confirm),
      signOutOtherSessions: z.boolean(),
    })
    .refine((value) => value.newPassword === value.confirmPassword, {
      message: e.mismatch,
      path: ['confirmPassword'],
    })
    .refine((value) => value.newPassword !== value.currentPassword, {
      message: e.same,
      path: ['newPassword'],
    });
}

type PasswordValues = z.infer<ReturnType<typeof buildPasswordSchema>>;

export function SettingsPortal() {
  const { setPage, clearPage, clearFooter } = useAdminShell();
  const { m } = useAdminI18n();

  useEffect(() => {
    setPage({
      breadcrumbs: [{ label: m.common.admin, href: '/admin' }, { label: m.settings.title }],
      title: m.settings.title,
      description: m.settings.description,
    });
    clearFooter();
    return () => {
      clearPage();
      clearFooter();
    };
  }, [clearFooter, clearPage, m, setPage]);

  return (
    <div className="grid items-start gap-6 p-4 min-[426px]:p-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <PasswordCard />
      <div className="space-y-6">
        <SessionsCard />
        <AppearanceCard />
        <LanguageCard />
      </div>
    </div>
  );
}

function PasswordCard() {
  const change = useChangePassword();
  const { m } = useAdminI18n();
  const passwordSchema = useMemo(() => buildPasswordSchema(m), [m]);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      signOutOtherSessions: true,
    },
  });

  const submit = (values: PasswordValues) => {
    change.mutate(values, {
      onSuccess: (result) => {
        toast.success(
          result.revokedSessions > 0
            ? m.settings.changedRevoked(result.revokedSessions)
            : m.settings.changed,
        );
        reset();
      },
      onError: (error) => {
        const { message, fieldErrors } = readServerError(error, m.common.requestFailed);
        // The server answers in English; the one user-facing check is mapped locally.
        if (fieldErrors.currentPassword) {
          setError('currentPassword', { type: 'server', message: m.settings.errors.incorrect });
          toast.error(m.settings.errors.incorrect);
          return;
        }
        for (const [field, messages] of Object.entries(fieldErrors)) {
          if (messages?.[0]) {
            setError(field as keyof PasswordValues, { type: 'server', message: messages[0] });
          }
        }
        toast.error(message);
      },
    });
  };

  return (
    <AdminCard>
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="size-4 text-primary" />
          {m.settings.password}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{m.settings.passwordBody}</p>
      </div>
      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5 p-6">
        <AccountField
          label={m.settings.current}
          htmlFor="settings-current"
          error={errors.currentPassword?.message}
        >
          <AdminInput
            id="settings-current"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.currentPassword)}
            {...register('currentPassword')}
          />
        </AccountField>
        <AccountField
          label={m.settings.new}
          htmlFor="settings-new"
          error={errors.newPassword?.message}
        >
          <AdminInput
            id="settings-new"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.newPassword)}
            {...register('newPassword')}
          />
        </AccountField>
        <AccountField
          label={m.settings.confirm}
          htmlFor="settings-confirm"
          error={errors.confirmPassword?.message}
        >
          <AdminInput
            id="settings-confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </AccountField>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--primary)]"
            {...register('signOutOtherSessions')}
          />
          <span>
            <span className="block font-medium">{m.settings.signOutOthers}</span>
            <span className="block text-xs leading-5 text-muted-foreground">
              {m.settings.signOutOthersBody}
            </span>
          </span>
        </label>

        <div className="flex justify-end border-t border-border pt-5">
          <AdminButton type="submit" disabled={change.isPending}>
            {change.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
            {m.settings.change}
          </AdminButton>
        </div>
      </form>
    </AdminCard>
  );
}

function SessionsCard() {
  const sessions = useAccountSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [pending, setPending] = useState<AccountSessionDto | 'others' | null>(null);
  const { m, fmt } = useAdminI18n();

  const others = sessions.data?.filter((session) => !session.current) ?? [];

  const confirm = () => {
    if (pending === 'others') {
      revokeOthers.mutate(undefined, {
        onSuccess: (result) => {
          toast.success(m.settings.revokedCount(result.revoked));
          setPending(null);
        },
        onError: (error) => toast.error(readServerError(error, m.common.requestFailed).message),
      });
      return;
    }
    if (!pending) return;
    revoke.mutate(pending.id, {
      onSuccess: () => {
        toast.success(m.settings.revokedOne(fmt.device(pending.userAgent)));
        setPending(null);
      },
      onError: (error) => toast.error(readServerError(error, m.common.requestFailed).message),
    });
  };

  return (
    <AdminCard>
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MonitorSmartphone className="size-4 text-primary" />
            {m.settings.devices}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{m.settings.devicesBody}</p>
        </div>
        {others.length > 0 ? (
          <AdminButton size="sm" variant="outline" onClick={() => setPending('others')}>
            <LogOut />
            {m.settings.signOutOthersShort}
          </AdminButton>
        ) : null}
      </div>

      {sessions.isPending ? (
        <div className="space-y-3 p-6">
          <AdminSkeleton className="h-12" />
          <AdminSkeleton className="h-12" />
        </div>
      ) : sessions.isError ? (
        <div className="p-6">
          <p className="flex items-center gap-2 text-sm">
            <CircleAlert className="size-4 text-destructive" />
            {m.settings.devicesFailed}
          </p>
          <AdminButton className="mt-3" size="sm" onClick={() => sessions.refetch()}>
            {m.common.retry}
          </AdminButton>
        </div>
      ) : sessions.data.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">{m.settings.devicesEmpty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {sessions.data.map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {fmt.device(session.userAgent)}
                  {session.current ? (
                    <AdminBadge variant="success">{m.settings.thisDevice}</AdminBadge>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {m.settings.sessionLine(
                    fmt.dateTime(session.startedAt),
                    fmt.relative(session.lastActiveAt),
                  )}
                </p>
              </div>
              {session.current ? null : (
                <AdminButton
                  size="sm"
                  variant="ghost"
                  onClick={() => setPending(session)}
                  aria-label={m.settings.signOutLabel(fmt.device(session.userAgent))}
                >
                  {m.settings.signOut}
                </AdminButton>
              )}
            </li>
          ))}
        </ul>
      )}

      <AdminDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending === 'others' ? m.settings.confirmOthersTitle : m.settings.confirmOneTitle}
        description={
          pending === 'others'
            ? m.settings.confirmOthersBody(others.length)
            : pending
              ? m.settings.confirmOneBody(fmt.device(pending.userAgent))
              : undefined
        }
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setPending(null)}>
              {m.common.cancel}
            </AdminButton>
            <AdminButton
              variant="destructive"
              onClick={confirm}
              disabled={revoke.isPending || revokeOthers.isPending}
            >
              {revoke.isPending || revokeOthers.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <LogOut />
              )}
              {m.settings.signOut}
            </AdminButton>
          </>
        }
      />
    </AdminCard>
  );
}

function AppearanceCard() {
  const { m } = useAdminI18n();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const options = [
    { value: 'system', label: m.settings.themes.system, icon: Laptop },
    { value: 'light', label: m.settings.themes.light, icon: Sun },
    { value: 'dark', label: m.settings.themes.dark, icon: Moon },
  ];

  return (
    <AdminCard className="p-6">
      <h2 className="text-sm font-semibold">{m.settings.appearance}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{m.settings.appearanceBody}</p>
      <div
        role="radiogroup"
        aria-label={m.shell.theme.group}
        className="mt-4 grid grid-cols-3 gap-2"
      >
        {options.map(({ value, label, icon: Icon }) => {
          const active = mounted && theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(value)}
              className={cn(
                'flex h-16 flex-col items-center justify-center gap-1.5 rounded-md border text-xs font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                active
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          );
        })}
      </div>
    </AdminCard>
  );
}

function LanguageCard() {
  const { m, locale, setLocale } = useAdminI18n();
  return (
    <AdminCard className="p-6">
      <h2 className="text-sm font-semibold">{m.settings.language}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{m.settings.languageBody}</p>
      <div
        role="radiogroup"
        aria-label={m.settings.language}
        className="mt-4 grid grid-cols-2 gap-2"
      >
        {ADMIN_LOCALES.map((value) => {
          const active = locale === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              lang={value}
              aria-checked={active}
              onClick={() => setLocale(value)}
              className={cn(
                'flex h-12 items-center justify-center gap-2 rounded-md border text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                active
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="text-[11px] font-semibold uppercase">{value}</span>
              {m.languages[value]}
            </button>
          );
        })}
      </div>
    </AdminCard>
  );
}
