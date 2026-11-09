'use client';

import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminInput } from '@/components/ui/admin-input';
import { AdminSelect } from '@/components/ui/admin-select';
import { AdminSheet } from '@/components/ui/admin-sheet';
import { useCreateAdminUser, useUpdateAdminUser } from '@/hooks/content/admin';
import { useAdminI18n } from '@/lib/i18n/admin';
import type {
  AdminUserCreatePayload,
  AdminUserUpdatePayload,
  ResponseUserDto,
  ServerErrorResponse,
  UserRole,
  UserStatus,
} from '@/types';

export type UserFormMode = 'create' | 'edit';

interface UserFormValues {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  locale: 'en' | 'fr' | 'ar';
  status: UserStatus;
}

export function UserFormSheet({
  open,
  mode,
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: UserFormMode;
  user: ResponseUserDto | null;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (user: ResponseUserDto) => void;
}) {
  const createUser = useCreateAdminUser();
  const updateUser = useUpdateAdminUser();
  const [serverError, setServerError] = useState<string | null>(null);
  const { m } = useAdminI18n();
  const roleOptions = (['CLIENT', 'MOVER', 'ADMIN'] as const).map((value) => ({
    value,
    label: m.common.roles[value],
  }));
  const localeOptions = (['en', 'fr', 'ar'] as const).map((value) => ({
    value,
    label: m.languages[value],
  }));
  const statusOptions = (['ACTIVE', 'BLOCKED'] as const).map((value) => ({
    value,
    label: m.userForm.statusOptions[value],
  }));

  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(2, m.common.nameMin),
          email: z.string().trim().email(m.common.emailInvalid),
          phone: z
            .string()
            .trim()
            .regex(/^\+?[0-9]{8,15}$/, m.common.phoneInvalid),
          password: z.string(),
          role: z.enum(['CLIENT', 'MOVER', 'ADMIN']),
          locale: z.enum(['en', 'fr', 'ar']),
          status: z.enum(['ACTIVE', 'BLOCKED']),
        })
        .superRefine((values, context) => {
          if (mode === 'edit' && !values.password) return;
          if (values.password.length < 8) {
            context.addIssue({
              code: 'custom',
              path: ['password'],
              message: m.common.passwordRules.min,
            });
          }
          if (!/[A-Z]/.test(values.password)) {
            context.addIssue({
              code: 'custom',
              path: ['password'],
              message: m.common.passwordRules.upper,
            });
          }
          if (!/[0-9]/.test(values.password)) {
            context.addIssue({
              code: 'custom',
              path: ['password'],
              message: m.common.passwordRules.digit,
            });
          }
        }),
    [m, mode],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema) as Resolver<UserFormValues>,
    defaultValues: getDefaultValues(mode, user),
  });

  useEffect(() => {
    if (!open) return;
    reset(getDefaultValues(mode, user));
    setServerError(null);
  }, [mode, open, reset, user]);

  const isPending = createUser.isPending || updateUser.isPending;

  const submit = (values: UserFormValues) => {
    setServerError(null);
    if (mode === 'create') {
      createUser.mutate(values as AdminUserCreatePayload, {
        onSuccess: (created) => {
          toast.success(m.userForm.created(created.name));
          onSaved(created);
        },
        onError: (error) =>
          applyServerError(error, setError, setServerError, m.userForm.saveFailed),
      });
      return;
    }

    if (!user) return;
    const payload: AdminUserUpdatePayload = {
      name: values.name,
      email: values.email,
      phone: values.phone,
      role: values.role,
      locale: values.locale,
      status: values.status,
      ...(values.password ? { password: values.password } : {}),
    };
    updateUser.mutate(
      { id: user.id, payload },
      {
        onSuccess: (updated) => {
          toast.success(m.userForm.updated(updated.name));
          onSaved(updated);
        },
        onError: (error) =>
          applyServerError(error, setError, setServerError, m.userForm.saveFailed),
      },
    );
  };

  return (
    <AdminSheet
      open={open}
      onOpenChange={(next) => !next && !isPending && onClose()}
      title={mode === 'create' ? m.userForm.createTitle : m.userForm.editTitle(user?.name ?? '')}
      description={mode === 'create' ? m.userForm.createBody : m.userForm.editBody}
      footer={
        <>
          <AdminButton type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            {m.common.cancel}
          </AdminButton>
          <AdminButton type="submit" form="admin-user-form" disabled={isPending}>
            {isPending ? (
              <Loader2 className="animate-spin" />
            ) : mode === 'create' ? (
              <UserPlus />
            ) : (
              <Save />
            )}
            {mode === 'create' ? m.userForm.create : m.common.saveChanges}
          </AdminButton>
        </>
      }
    >
      <form id="admin-user-form" onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
        <FormField label={m.userForm.name} htmlFor="admin-user-name" error={errors.name?.message}>
          <AdminInput
            id="admin-user-name"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </FormField>

        <FormField
          label={m.userForm.email}
          htmlFor="admin-user-email"
          error={errors.email?.message}
        >
          <AdminInput
            id="admin-user-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </FormField>

        <FormField
          label={m.userForm.phone}
          htmlFor="admin-user-phone"
          error={errors.phone?.message}
        >
          <AdminInput
            id="admin-user-phone"
            type="tel"
            autoComplete="tel"
            aria-invalid={Boolean(errors.phone)}
            {...register('phone')}
          />
        </FormField>

        <FormField
          label={mode === 'create' ? m.userForm.password : m.userForm.newPassword}
          htmlFor="admin-user-password"
          description={
            mode === 'edit' ? m.userForm.passwordEditHint : m.userForm.passwordCreateHint
          }
          error={errors.password?.message}
        >
          <AdminInput
            id="admin-user-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2 min-[1500px]:grid-cols-1">
          <FormField label={m.userForm.role} htmlFor="admin-user-role" error={errors.role?.message}>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <AdminSelect
                  id="admin-user-role"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={roleOptions}
                  ariaLabel={m.userForm.roleLabel}
                  className="w-full"
                  disabled={isSelf}
                />
              )}
            />
          </FormField>
          <FormField
            label={m.userForm.locale}
            htmlFor="admin-user-locale"
            error={errors.locale?.message}
          >
            <Controller
              name="locale"
              control={control}
              render={({ field }) => (
                <AdminSelect
                  id="admin-user-locale"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={localeOptions}
                  ariaLabel={m.userForm.localeLabel}
                  className="w-full"
                />
              )}
            />
          </FormField>
        </div>

        <FormField
          label={m.userForm.status}
          htmlFor="admin-user-status"
          description={isSelf ? m.userForm.selfStatus : undefined}
          error={errors.status?.message}
        >
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <AdminSelect
                id="admin-user-status"
                value={field.value}
                onValueChange={field.onChange}
                options={statusOptions}
                ariaLabel={m.userForm.statusLabel}
                className="w-full"
                disabled={isSelf}
              />
            )}
          />
        </FormField>

        {serverError ? (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {serverError}
          </p>
        ) : null}
      </form>
    </AdminSheet>
  );
}

function FormField({
  label,
  htmlFor,
  description,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  description?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold">
        {label}
      </label>
      {children}
      {description ? (
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function getDefaultValues(mode: UserFormMode, user: ResponseUserDto | null): UserFormValues {
  if (mode === 'edit' && user) {
    return {
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: '',
      role: user.role,
      locale: user.locale as UserFormValues['locale'],
      status: user.status,
    };
  }
  return {
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'CLIENT',
    locale: 'en',
    status: 'ACTIVE',
  };
}

function applyServerError(
  error: unknown,
  setError: ReturnType<typeof useForm<UserFormValues>>['setError'],
  setServerError: (message: string) => void,
  fallback: string,
) {
  const response = (error as AxiosError<ServerErrorResponse>).response?.data;
  const details = response?.details as
    { fieldErrors?: Partial<Record<keyof UserFormValues, string[]>> } | undefined;
  if (details?.fieldErrors) {
    for (const [field, messages] of Object.entries(details.fieldErrors)) {
      if (messages?.[0]) {
        setError(field as keyof UserFormValues, { type: 'server', message: messages[0] });
      }
    }
  }
  setServerError(response?.message ?? fallback);
}
