'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError, FieldRow, Label } from '@/components/ui/field';
import { HOME_TYPES, type HomePayload } from '@/types/homes';
import { Checkbox, NativeSelect, Textarea } from './form-controls';
import {
  apiErrorMessage,
  HOME_TYPE_LABELS,
  HomeFormSchema,
  type HomeFormValues,
} from './home-schemas';

const EMPTY_HOME: HomeFormValues = {
  label: '',
  city: '',
  type: 'APARTMENT',
  floor: 0,
  hasElevator: false,
  notes: '',
};

interface HomeFormProps {
  defaultValues?: HomeFormValues;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (values: HomePayload) => void;
  onCancel?: () => void;
}

/** Create / edit the house details (rooms are managed separately on the house page). */
export function HomeForm({
  defaultValues = EMPTY_HOME,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: HomeFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<HomeFormValues>({ resolver: zodResolver(HomeFormSchema), defaultValues });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 md:grid-cols-2">
      <FieldRow>
        <Label htmlFor="home-label">House name</Label>
        <Input
          id="home-label"
          placeholder="Our new flat"
          aria-invalid={Boolean(errors.label)}
          {...register('label')}
        />
        <FieldError message={errors.label?.message} />
      </FieldRow>

      <FieldRow>
        <Label htmlFor="home-city">City</Label>
        <Input
          id="home-city"
          placeholder="Sfax"
          autoComplete="address-level2"
          aria-invalid={Boolean(errors.city)}
          {...register('city')}
        />
        <FieldError message={errors.city?.message} />
      </FieldRow>

      <FieldRow>
        <Label htmlFor="home-type">Type</Label>
        <NativeSelect id="home-type" {...register('type')}>
          {HOME_TYPES.map((type) => (
            <option key={type} value={type}>
              {HOME_TYPE_LABELS[type]}
            </option>
          ))}
        </NativeSelect>
      </FieldRow>

      <FieldRow>
        <Label htmlFor="home-floor">Floor (0 = ground)</Label>
        <Input
          id="home-floor"
          type="number"
          inputMode="numeric"
          min={0}
          max={60}
          aria-invalid={Boolean(errors.floor)}
          {...register('floor', { valueAsNumber: true })}
        />
        <FieldError message={errors.floor?.message} />
      </FieldRow>

      <Checkbox
        id="home-elevator"
        label="The building has an elevator"
        className="md:col-span-2"
        {...register('hasElevator')}
      />

      <FieldRow className="md:col-span-2">
        <Label htmlFor="home-notes">Notes (optional)</Label>
        <Textarea
          id="home-notes"
          placeholder="Access, parking, narrow staircase…"
          aria-invalid={Boolean(errors.notes)}
          {...register('notes')}
        />
        <FieldError message={errors.notes?.message} />
      </FieldRow>

      {Boolean(error) && (
        <p
          role="alert"
          className="mono border border-hazard bg-hazard/5 px-3 py-2 text-[11px] text-hazard md:col-span-2"
        >
          {apiErrorMessage(error)}
        </p>
      )}

      <div className="flex flex-wrap gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-label="Saving" /> : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
