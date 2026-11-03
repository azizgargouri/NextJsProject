'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/field';
import { createClaimAction } from '@/app/(dashboard)/dashboard/actions';
import { initialActionState } from '@/lib/actions/action-state';
import { CLAIM_CATEGORIES, CLAIM_CATEGORY_LABELS } from '@/lib/quality/constants';
import { FormMessage, NativeSelect, SubmitButton, Textarea } from './workspace-ui';

/**
 * New-claim form: <form action={serverAction}> (course ch.5 "Formulaires et Server Actions").
 * No useState per field — the browser builds FormData and Next posts it to the action.
 * useActionState gives back validation errors; useFormStatus drives the button.
 * Works even before JavaScript loads (progressive enhancement).
 */
export function ClaimForm({ movers }: { movers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [state, formAction] = useActionState(createClaimAction, initialActionState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  useEffect(() => {
    if (state.ok && state.redirectTo) router.push(state.redirectTo);
  }, [router, state]);

  return (
    <form
      action={formAction}
      className="grid gap-6 border border-ink bg-paper p-6 md:grid-cols-2"
      noValidate
    >
      <div className="md:col-span-2">
        <Label htmlFor="subject">Subject *</Label>
        <Input
          id="subject"
          name="subject"
          defaultValue={values.subject}
          placeholder="e.g. Glass table broken during unloading"
          aria-invalid={Boolean(errors.subject)}
          maxLength={120}
          required
        />
        <FieldError message={errors.subject?.[0]} />
      </div>

      <div>
        <Label htmlFor="category">Category *</Label>
        <NativeSelect id="category" name="category" defaultValue={values.category ?? 'DAMAGE'}>
          {CLAIM_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CLAIM_CATEGORY_LABELS[category]}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div>
        <Label htmlFor="moverId">Mover concerned</Label>
        <NativeSelect
          id="moverId"
          name="moverId"
          defaultValue={values.moverId ?? ''}
          aria-invalid={Boolean(errors.moverId)}
        >
          <option value="">— Not sure / not applicable —</option>
          {movers.map((mover) => (
            <option key={mover.id} value={mover.id}>
              {mover.name}
            </option>
          ))}
        </NativeSelect>
        <FieldError message={errors.moverId?.[0]} />
      </div>

      <div>
        <Label htmlFor="moveReference">Move reference</Label>
        <Input
          id="moveReference"
          name="moveReference"
          defaultValue={values.moveReference}
          placeholder="MV-2026-0142"
          aria-invalid={Boolean(errors.moveReference)}
        />
        <FieldError message={errors.moveReference?.[0]} />
      </div>

      <div>
        <Label htmlFor="amountClaimed">Amount claimed (TND)</Label>
        <Input
          id="amountClaimed"
          name="amountClaimed"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.001"
          defaultValue={values.amountClaimed}
          aria-invalid={Boolean(errors.amountClaimed)}
        />
        <FieldError message={errors.amountClaimed?.[0]} />
      </div>

      <div className="md:col-span-2">
        <Label htmlFor="description">What happened? *</Label>
        <Textarea
          id="description"
          name="description"
          rows={6}
          defaultValue={values.description}
          placeholder="Describe the issue: when, which items, what you expect…"
          aria-invalid={Boolean(errors.description)}
          maxLength={2000}
          required
        />
        <FieldError message={errors.description?.[0]} />
      </div>

      <div className="flex flex-col gap-4 md:col-span-2 md:flex-row md:items-center md:justify-between">
        <FormMessage ok={state.ok} message={state.message} />
        <SubmitButton variant="hazard" pendingLabel="Submitting…" className="md:ml-auto">
          Submit claim
        </SubmitButton>
      </div>
    </form>
  );
}
