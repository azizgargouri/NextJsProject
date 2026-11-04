'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CircleAlert, ImageUp, Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdminBadge } from '@/components/ui/admin-badge';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { AdminInput } from '@/components/ui/admin-input';
import { AdminSelect } from '@/components/ui/admin-select';
import { AdminSkeleton } from '@/components/ui/admin-skeleton';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  useAccountProfile,
  useRemoveAvatar,
  useUpdateProfile,
  useUploadAvatar,
} from '@/hooks/content/account';
import { useAdminI18n, type AdminMessages } from '@/lib/i18n/admin';
import type { ResponseUserDto } from '@/types';
import { useAdminShell } from '../shell/admin-shell-context';
import { AccountField, readServerError } from './account-field';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function buildSchema(m: AdminMessages) {
  return z.object({
    name: z.string().trim().min(2, m.common.nameMin).max(80),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{8,15}$/, m.common.phoneInvalid),
    locale: z.enum(['en', 'fr', 'ar']),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

const PROFILE_FIELDS = ['name', 'phone', 'locale'] as const;

export function ProfilePortal() {
  const { setPage, clearPage, clearFooter } = useAdminShell();
  const profile = useAccountProfile();
  const { m } = useAdminI18n();

  useEffect(() => {
    setPage({
      breadcrumbs: [{ label: m.common.admin, href: '/admin' }, { label: m.profile.title }],
      title: m.profile.title,
      description: m.profile.description,
    });
    clearFooter();
    return () => {
      clearPage();
      clearFooter();
    };
  }, [clearFooter, clearPage, m, setPage]);

  if (profile.isPending) {
    return (
      <div className="grid gap-6 p-4 min-[426px]:p-10 lg:grid-cols-[320px_minmax(0,1fr)]">
        <AdminSkeleton className="h-72" />
        <AdminSkeleton className="h-96" />
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <div className="p-4 min-[426px]:p-10">
        <AdminCard className="max-w-xl p-6">
          <CircleAlert className="size-5 text-destructive" />
          <h2 className="mt-4 text-base font-semibold">{m.profile.loadFailed}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{m.profile.loadFailedBody}</p>
          <AdminButton className="mt-5" size="sm" onClick={() => profile.refetch()}>
            {m.common.retry}
          </AdminButton>
        </AdminCard>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 p-4 min-[426px]:p-10 lg:grid-cols-[320px_minmax(0,1fr)]">
      <AvatarCard user={profile.data} />
      <ProfileForm user={profile.data} />
    </div>
  );
}

function AvatarCard({ user }: { user: ResponseUserDto }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const busy = upload.isPending || remove.isPending;
  const { m, fmt } = useAdminI18n();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error(m.profile.photoType);
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(m.profile.photoSize);
      return;
    }
    upload.mutate(file, {
      onSuccess: () => toast.success(m.profile.photoUpdated),
      onError: (error) => toast.error(readServerError(error, m.common.requestFailed).message),
    });
  };

  return (
    <AdminCard className="p-6">
      <div className="flex flex-col items-center text-center">
        <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="lg" />
        <p className="mt-4 text-base font-semibold">{user.name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
        <div className="mt-3 flex items-center gap-2">
          <AdminBadge variant="outline">{m.common.roles[user.role]}</AdminBadge>
          <AdminBadge variant={user.status === 'ACTIVE' ? 'success' : 'destructive'}>
            {m.profile.status[user.status]}
          </AdminBadge>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <input
          ref={input}
          type="file"
          accept={AVATAR_TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            onFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <AdminButton onClick={() => input.current?.click()} disabled={busy}>
          {upload.isPending ? <Loader2 className="animate-spin" /> : <ImageUp />}
          {user.avatarUrl ? m.profile.replacePhoto : m.profile.uploadPhoto}
        </AdminButton>
        {user.avatarUrl ? (
          <AdminButton
            variant="ghost"
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => toast.success(m.profile.photoRemoved),
                onError: (error) =>
                  toast.error(readServerError(error, m.common.requestFailed).message),
              })
            }
            disabled={busy}
          >
            {remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {m.profile.removePhoto}
          </AdminButton>
        ) : null}
        <p className="mt-1 text-center text-xs leading-5 text-muted-foreground">
          {m.profile.photoHint}
        </p>
      </div>

      <dl className="mt-6 space-y-2 border-t border-border pt-4 text-xs">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{m.profile.memberSince}</dt>
          <dd className="font-medium">{fmt.date(user.createdAt)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{m.profile.lastUpdated}</dt>
          <dd className="font-medium">{fmt.date(user.updatedAt)}</dd>
        </div>
      </dl>
    </AdminCard>
  );
}

function ProfileForm({ user }: { user: ResponseUserDto }) {
  const update = useUpdateProfile();
  const { m } = useAdminI18n();
  const schema = useMemo(() => buildSchema(m), [m]);
  const localeOptions = (['en', 'fr', 'ar'] as const).map((value) => ({
    value,
    label: m.languages[value],
  }));
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toValues(user),
  });

  useEffect(() => {
    reset(toValues(user));
  }, [reset, user]);

  const submit = (values: FormValues) => {
    const payload = Object.fromEntries(
      Object.keys(dirtyFields).map((key) => [key, values[key as keyof FormValues]]),
    );
    update.mutate(payload, {
      onSuccess: () => toast.success(m.profile.saved),
      onError: (error) => {
        const { message, fieldErrors } = readServerError(error, m.common.requestFailed);
        for (const [field, messages] of Object.entries(fieldErrors)) {
          if (messages?.[0] && (PROFILE_FIELDS as readonly string[]).includes(field)) {
            setError(field as keyof FormValues, { type: 'server', message: messages[0] });
          }
        }
        toast.error(message);
      },
    });
  };

  return (
    <AdminCard>
      <div className="border-b border-border px-6 py-5">
        <h2 className="text-sm font-semibold">{m.profile.personal}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{m.profile.personalBody}</p>
      </div>
      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5 p-6">
        <AccountField label={m.profile.name} htmlFor="profile-name" error={errors.name?.message}>
          <AdminInput
            id="profile-name"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </AccountField>

        <AccountField
          label={m.profile.email}
          htmlFor="profile-email"
          description={m.profile.emailHint}
        >
          <AdminInput id="profile-email" value={user.email} readOnly disabled />
        </AccountField>

        <div className="grid gap-5 sm:grid-cols-2">
          <AccountField
            label={m.profile.phone}
            htmlFor="profile-phone"
            error={errors.phone?.message}
          >
            <AdminInput
              id="profile-phone"
              type="tel"
              autoComplete="tel"
              aria-invalid={Boolean(errors.phone)}
              {...register('phone')}
            />
          </AccountField>
          <AccountField
            label={m.profile.language}
            htmlFor="profile-locale"
            description={m.profile.languageHint}
            error={errors.locale?.message}
          >
            <Controller
              name="locale"
              control={control}
              render={({ field }) => (
                <AdminSelect
                  id="profile-locale"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={localeOptions}
                  ariaLabel={m.profile.language}
                  className="w-full"
                />
              )}
            />
          </AccountField>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-5">
          <AdminButton
            type="button"
            variant="ghost"
            disabled={!isDirty || update.isPending}
            onClick={() => reset(toValues(user))}
          >
            {m.common.discard}
          </AdminButton>
          <AdminButton type="submit" disabled={!isDirty || update.isPending}>
            {update.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            {m.common.saveChanges}
          </AdminButton>
        </div>
      </form>
    </AdminCard>
  );
}

function toValues(user: ResponseUserDto): FormValues {
  return {
    name: user.name,
    phone: user.phone,
    locale: (['en', 'fr', 'ar'].includes(user.locale) ? user.locale : 'en') as FormValues['locale'],
  };
}
