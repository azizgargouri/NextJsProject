'use client';

import { useEffect, useState } from 'react';
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

const numeric = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .refine((value) => /^\d+(\.\d+)?$/.test(value), `${label} must be a number`)
    .refine((value) => Number(value) >= 0, `${label} cannot be negative`);

const schema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(64),
    status: z.enum(['ACTIVE', 'RETIRED']),
    baseFare: numeric('Base fare'),
    perKm: numeric('Per km'),
    perM3: numeric('Per m³'),
    expressSurcharge: z
      .string()
      .min(1, 'Express surcharge is required')
      .refine((value) => /^\d+(\.\d+)?$/.test(value), 'Must be a number')
      .refine(
        (value) => Number(value) >= 0 && Number(value) <= 100,
        'Express surcharge is a percentage (0–100)',
      ),
    minQuote: numeric('Minimum quote'),
    effectiveFrom: z.string().min(1, 'Effective start date is required'),
    effectiveTo: z.string(),
  })
  .refine((values) => !values.effectiveTo || values.effectiveTo > values.effectiveFrom, {
    message: 'The window must end after it starts',
    path: ['effectiveTo'],
  });

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
      setServerError(response?.message ?? 'The rule could not be saved. Try again.');
    };

    if (mode === 'create') {
      createRule.mutate(payload, {
        onSuccess: (created) => {
          toast.success(`${created.name} was created.`);
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
          toast.success(`${updated.name} was updated to v${updated.version}.`);
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
      title={mode === 'create' ? 'Create pricing rule' : `Edit ${rule?.name ?? 'rule'}`}
      description={
        mode === 'create'
          ? 'Define the quote formula. Creating an active rule retires the previous one.'
          : 'Changes create a new version. Activation takes over exclusivity automatically.'
      }
      footer={
        <>
          <AdminButton variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </AdminButton>
          <AdminButton type="submit" form="admin-pricing-form" disabled={isPending}>
            {isPending ? (
              <Loader2 className="animate-spin" />
            ) : mode === 'create' ? (
              <Coins />
            ) : (
              <Save />
            )}
            {mode === 'create' ? 'Create rule' : 'Save new version'}
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
        <FormField label="Rule name" htmlFor="admin-pricing-name" error={errors.name?.message}>
          <AdminInput
            id="admin-pricing-name"
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-3">
          <FormField
            label="Base fare (TND)"
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
          <FormField label="Per km (TND)" htmlFor="admin-pricing-km" error={errors.perKm?.message}>
            <AdminInput
              id="admin-pricing-km"
              inputMode="decimal"
              placeholder="1.200"
              aria-invalid={Boolean(errors.perKm)}
              {...register('perKm')}
            />
          </FormField>
          <FormField label="Per m³ (TND)" htmlFor="admin-pricing-m3" error={errors.perM3?.message}>
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
            label="Express surcharge (%)"
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
            label="Minimum quote (TND)"
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
            label="Effective from"
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
            label="Effective until (optional)"
            htmlFor="admin-pricing-to"
            description="Leave empty for an open-ended window."
            error={errors.effectiveTo?.message}
          >
            <AdminInput id="admin-pricing-to" type="date" {...register('effectiveTo')} />
          </FormField>
        </div>

        <FormField
          label="Status"
          htmlFor="admin-pricing-status"
          error={errors.status?.message}
          description="Only one rule can be active. Activation retires every other rule."
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
                  { value: 'ACTIVE', label: 'Active — the live quote table' },
                  { value: 'RETIRED', label: 'Retired — kept for history' },
                ]}
                ariaLabel="Pricing rule status"
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
