'use client';

import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Coins, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminInput } from '@/components/ui/admin-input';
import { AdminSelect } from '@/components/ui/admin-select';
import { AdminSheet } from '@/components/ui/admin-sheet';
import { useCreatePricingRule, useUpdatePricingRule } from '@/hooks/content/admin';
import { useAdminI18n, type AdminMessages } from '@/lib/i18n/admin';
import type { PricingRuleDto, PricingRulePayload, ServerErrorResponse } from '@/types';

export type PricingFormMode = 'create' | 'edit';

interface FormValues {
  name: string;
  status: PricingRuleDto['status'];
  baseFare: string;
  perKm: string;
  perM3: string;
  expressSurcharge: string;
  minQuote: string;
  effectiveFrom: string;
  effectiveTo: string;
}

function buildSchema(m: AdminMessages) {
  const e = m.pricingForm.errors;
  const f = m.pricingForm.fieldNames;
  const numeric = (label: string) =>
    z
      .string()
      .min(1, e.required(label))
      .refine((value) => /^\d+(\.\d+)?$/.test(value), e.number(label))
      .refine((value) => Number(value) >= 0, e.negative(label));

  return z
    .object({
      name: z.string().trim().min(2, e.nameMin).max(64),
      status: z.enum(['ACTIVE', 'RETIRED']),
      baseFare: numeric(f.baseFare),
      perKm: numeric(f.perKm),
      perM3: numeric(f.perM3),
      expressSurcharge: z
        .string()
        .min(1, e.required(f.express))
        .refine((value) => /^\d+(\.\d+)?$/.test(value), e.number(f.express))
        .refine((value) => Number(value) >= 0 && Number(value) <= 100, e.percent),
      minQuote: numeric(f.minQuote),
      effectiveFrom: z.string().min(1, e.fromRequired),
      effectiveTo: z.string(),
    })
    .refine((values) => !values.effectiveTo || values.effectiveTo > values.effectiveFrom, {
      message: e.window,
      path: ['effectiveTo'],
    });
}

export function PricingFormSheet({
  open,
  mode,
  rule,
  onClose,
}: {
  open: boolean;
  mode: PricingFormMode;
  rule: PricingRuleDto | null;
  onClose: () => void;
}) {
  const createRule = useCreatePricingRule();
  const updateRule = useUpdatePricingRule();
  const [serverError, setServerError] = useState<string | null>(null);
  const { m } = useAdminI18n();
  const schema = useMemo(() => buildSchema(m), [m]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: getDefaultValues(mode, rule),
  });

  useEffect(() => {
    if (!open) return;
    reset(getDefaultValues(mode, rule));
    setServerError(null);
  }, [mode, open, reset, rule]);

  const isPending = createRule.isPending || updateRule.isPending;

  const submit = (values: FormValues) => {
    setServerError(null);
    const payload: PricingRulePayload = {
      name: values.name,
      status: values.status,
      baseFare: Number(values.baseFare),
      perKm: Number(values.perKm),
      perM3: Number(values.perM3),
      expressSurcharge: Number(values.expressSurcharge),
      minQuote: Number(values.minQuote),
      effectiveFrom: new Date(values.effectiveFrom).toISOString(),
      effectiveTo: values.effectiveTo ? new Date(values.effectiveTo).toISOString() : null,
    };

    const onError = (error: unknown) => {
      const response = (error as AxiosError<ServerErrorResponse>).response?.data;
      const details = response?.details as
        { fieldErrors?: Partial<Record<keyof FormValues, string[]>> } | undefined;
      if (details?.fieldErrors) {
        for (const [field, messages] of Object.entries(details.fieldErrors)) {
          if (messages?.[0]) {
            setError(field as keyof FormValues, { type: 'server', message: messages[0] });
          }
        }
      }
      setServerError(response?.message ?? m.pricingForm.saveFailed);
    };

    if (mode === 'create') {
      createRule.mutate(payload, {
        onSuccess: (created) => {
          toast.success(m.pricingForm.created(created.name));
          onClose();
        },
        onError,
      });
      return;
    }

    if (!rule) return;
    updateRule.mutate(
      { id: rule.id, payload },
      {
        onSuccess: (updated) => {
          toast.success(m.pricingForm.updated(updated.name, updated.version));
          onClose();
        },
        onError,
      },
    );
  };

  return (
    <AdminSheet
      open={open}
      onOpenChange={(next) => !next && !isPending && onClose()}
      title={
        mode === 'create' ? m.pricingForm.createTitle : m.pricingForm.editTitle(rule?.name ?? '')
      }
      description={mode === 'create' ? m.pricingForm.createBody : m.pricingForm.editBody}
      footer={
        <>
          <AdminButton variant="secondary" onClick={onClose} disabled={isPending}>
            {m.common.cancel}
          </AdminButton>
          <AdminButton type="submit" form="admin-pricing-form" disabled={isPending}>
            {isPending ? (
              <Loader2 className="animate-spin" />
            ) : mode === 'create' ? (
              <Coins />
            ) : (
              <Save />
            )}
            {mode === 'create' ? m.pricingForm.create : m.pricingForm.saveVersion}
          </AdminButton>
        </>
      }
    >
      <form
        id="admin-pricing-form"
        onSubmit={handleSubmit(submit)}
        noValidate
        className="space-y-5"
      >
        <FormField
          label={m.pricingForm.name}
          htmlFor="admin-pricing-name"
          error={errors.name?.message}
        >
          <AdminInput
            id="admin-pricing-name"
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-3">
          <FormField
            label={m.pricingForm.baseFare}
            htmlFor="admin-pricing-base"
            error={errors.baseFare?.message}
          >
            <AdminInput
              id="admin-pricing-base"
              inputMode="decimal"
              placeholder="45.000"
              aria-invalid={Boolean(errors.baseFare)}
              {...register('baseFare')}
            />
          </FormField>
          <FormField
            label={m.pricingForm.perKm}
            htmlFor="admin-pricing-km"
            error={errors.perKm?.message}
          >
            <AdminInput
              id="admin-pricing-km"
              inputMode="decimal"
              placeholder="1.200"
              aria-invalid={Boolean(errors.perKm)}
              {...register('perKm')}
            />
          </FormField>
          <FormField
            label={m.pricingForm.perM3}
            htmlFor="admin-pricing-m3"
            error={errors.perM3?.message}
          >
            <AdminInput
              id="admin-pricing-m3"
              inputMode="decimal"
              placeholder="18.000"
              aria-invalid={Boolean(errors.perM3)}
              {...register('perM3')}
            />
          </FormField>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label={m.pricingForm.express}
            htmlFor="admin-pricing-express"
            error={errors.expressSurcharge?.message}
          >
            <AdminInput
              id="admin-pricing-express"
              inputMode="decimal"
              placeholder="20"
              aria-invalid={Boolean(errors.expressSurcharge)}
              {...register('expressSurcharge')}
            />
          </FormField>
          <FormField
            label={m.pricingForm.minQuote}
            htmlFor="admin-pricing-min"
            error={errors.minQuote?.message}
          >
            <AdminInput
              id="admin-pricing-min"
              inputMode="decimal"
              placeholder="60.000"
              aria-invalid={Boolean(errors.minQuote)}
              {...register('minQuote')}
            />
          </FormField>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label={m.pricingForm.from}
            htmlFor="admin-pricing-from"
            error={errors.effectiveFrom?.message}
          >
            <AdminInput
              id="admin-pricing-from"
              type="date"
              aria-invalid={Boolean(errors.effectiveFrom)}
              {...register('effectiveFrom')}
            />
          </FormField>
          <FormField
            label={m.pricingForm.to}
            htmlFor="admin-pricing-to"
            description={m.pricingForm.toHint}
            error={errors.effectiveTo?.message}
          >
            <AdminInput id="admin-pricing-to" type="date" {...register('effectiveTo')} />
          </FormField>
        </div>

        <FormField
          label={m.pricingForm.status}
          htmlFor="admin-pricing-status"
          error={errors.status?.message}
          description={m.pricingForm.statusHint}
        >
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <AdminSelect
                id="admin-pricing-status"
                value={field.value}
                onValueChange={field.onChange}
                options={[
                  { value: 'ACTIVE', label: m.pricingForm.statusOptions.ACTIVE },
                  { value: 'RETIRED', label: m.pricingForm.statusOptions.RETIRED },
                ]}
                ariaLabel={m.pricingForm.statusLabel}
                className="w-full"
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

function getDefaultValues(mode: PricingFormMode, rule: PricingRuleDto | null): FormValues {
  if (mode === 'edit' && rule) {
    return {
      name: rule.name,
      status: rule.status,
      baseFare: rule.baseFare.toFixed(3),
      perKm: rule.perKm.toFixed(3),
      perM3: rule.perM3.toFixed(3),
      expressSurcharge: String(rule.expressSurcharge),
      minQuote: rule.minQuote.toFixed(3),
      effectiveFrom: rule.effectiveFrom.slice(0, 10),
      effectiveTo: rule.effectiveTo ? rule.effectiveTo.slice(0, 10) : '',
    };
  }
  const today = new Date().toISOString().slice(0, 10);
  return {
    name: '',
    status: 'ACTIVE',
    baseFare: '',
    perKm: '',
    perM3: '',
    expressSurcharge: '',
    minQuote: '',
    effectiveFrom: today,
    effectiveTo: '',
  };
}
