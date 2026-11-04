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

const roleOptions = [
  { value: 'CLIENT', label: 'Client' },
  { value: 'MOVER', label: 'Mover' },
  { value: 'ADMIN', label: 'Admin' },
];

const localeOptions = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'ar', label: 'Arabic' },
];

const statusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'BLOCKED', label: 'Blocked' },
];

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

  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(2, 'Name must be at least 2 characters'),
          email: z.string().trim().email('Enter a valid email address'),
          phone: z
            .string()
            .trim()
            .regex(/^\+?[0-9]{8,15}$/, 'Enter 8–15 digits, optionally starting with +'),
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
              message: 'Password must be at least 8 characters',
            });
          }
          if (!/[A-Z]/.test(values.password)) {
            context.addIssue({
              code: 'custom',
              path: ['password'],
              message: 'Add at least one uppercase letter',
            });
          }
          if (!/[0-9]/.test(values.password)) {
            context.addIssue({
              code: 'custom',
              path: ['password'],
              message: 'Add at least one number',
            });
          }
        }),
    [mode],
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
          toast.success(`${created.name} was created.`);
          onSaved(created);
        },
        onError: (error) => applyServerError(error, setError, setServerError),
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
          toast.success(`${updated.name} was updated.`);
          onSaved(updated);
        },
        onError: (error) => applyServerError(error, setError, setServerError),
      },
    );
  };

  return (
    <AdminSheet
      open={open}
      onOpenChange={(next) => !next && !isPending && onClose()}
      title={mode === 'create' ? 'Create user account' : `Edit ${user?.name ?? 'account'}`}
      description={
        mode === 'create'
          ? 'Create credentials and assign platform access.'
          : 'Update identity, role, locale, status, or credentials.'
      }
      footer={
        <>
          <AdminButton type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </AdminButton>
          <AdminButton type="submit" form="admin-user-form" disabled={isPending}>
            {isPending ? (
              <Loader2 className="animate-spin" />
            ) : mode === 'create' ? (
              <UserPlus />
            ) : (
              <Save />
            )}
            {mode === 'create' ? 'Create account' : 'Save changes'}
          </AdminButton>
        </>
      }
    >
      <form id="admin-user-form" onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
        <FormField label="Full name" htmlFor="admin-user-name" error={errors.name?.message}>
          <AdminInput
            id="admin-user-name"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </FormField>

        <FormField label="Email" htmlFor="admin-user-email" error={errors.email?.message}>
          <AdminInput
            id="admin-user-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </FormField>

        <FormField label="Phone" htmlFor="admin-user-phone" error={errors.phone?.message}>
          <AdminInput
            id="admin-user-phone"
            type="tel"
            autoComplete="tel"
            aria-invalid={Boolean(errors.phone)}
            {...register('phone')}
          />
        </FormField>

        <FormField
          label={mode === 'create' ? 'Password' : 'New password'}
          htmlFor="admin-user-password"
          description={
            mode === 'edit'
              ? 'Leave blank to keep the current password. Changing it revokes active sessions.'
              : 'At least 8 characters, one uppercase letter, and one number.'
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
          <FormField label="Role" htmlFor="admin-user-role" error={errors.role?.message}>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <AdminSelect
                  id="admin-user-role"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={roleOptions}
                  ariaLabel="Account role"
                  className="w-full"
                  disabled={isSelf}
                />
              )}
            />
          </FormField>
          <FormField label="Locale" htmlFor="admin-user-locale" error={errors.locale?.message}>
            <Controller
              name="locale"
              control={control}
              render={({ field }) => (
                <AdminSelect
                  id="admin-user-locale"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={localeOptions}
                  ariaLabel="Preferred locale"
                  className="w-full"
                />
              )}
            />
          </FormField>
        </div>

        <FormField
          label="Access status"
          htmlFor="admin-user-status"
          description={isSelf ? 'Your own admin account cannot be deactivated.' : undefined}
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
                ariaLabel="Account access status"
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
  setServerError(response?.message ?? 'The account could not be saved. Try again.');
}
