'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/field';
import { createReviewAction } from '@/app/(dashboard)/dashboard/actions';
import { initialActionState } from '@/lib/actions/action-state';
import { FormMessage, NativeSelect, StarInput, SubmitButton, Textarea } from './workspace-ui';

/** Client review of a mover — Server Action + useActionState + useFormStatus (course ch.5). */
export function ReviewForm({
  movers,
  defaultMoverId,
  defaultMoveReference,
}: {
  movers: { id: string; name: string }[];
  defaultMoverId?: string;
  defaultMoveReference?: string;
}) {
  const [state, formAction] = useActionState(createReviewAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const [formKey, setFormKey] = useState(0);
  const errors = state.fieldErrors ?? {};
  const values = state.ok ? {} : (state.values ?? {});

  useEffect(() => {
    // Remount the form after success so the star inputs reset too.
    if (state.ok) setFormKey((key) => key + 1);
  }, [state]);

  return (
    <form
      key={formKey}
      ref={formRef}
      action={formAction}
      className="space-y-5 border border-ink p-6"
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="review-mover">Mover *</Label>
          <NativeSelect
            id="review-mover"
            name="moverId"
            defaultValue={values.moverId ?? defaultMoverId ?? ''}
            aria-invalid={Boolean(errors.moverId)}
            required
          >
            <option value="" disabled>
              Choose…
            </option>
            {movers.map((mover) => (
              <option key={mover.id} value={mover.id}>
                {mover.name}
              </option>
            ))}
          </NativeSelect>
          <FieldError message={errors.moverId?.[0]} />
        </div>
        <div>
          <Label htmlFor="review-move">Move reference *</Label>
          <Input
            id="review-move"
            name="moveReference"
            defaultValue={values.moveReference ?? defaultMoveReference ?? ''}
            placeholder="MV-2026-0142"
            aria-invalid={Boolean(errors.moveReference)}
            required
          />
          <FieldError message={errors.moveReference?.[0]} />
        </div>
      </div>

      <StarInput
        name="rating"
        label="Overall rating"
        required
        defaultValue={Number(values.rating) || undefined}
        error={errors.rating?.[0]}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <StarInput
          name="punctuality"
          label="Punctuality"
          defaultValue={Number(values.punctuality) || undefined}
        />
        <StarInput
          name="care"
          label="Care of items"
          defaultValue={Number(values.care) || undefined}
        />
        <StarInput
          name="communication"
          label="Communication"
          defaultValue={Number(values.communication) || undefined}
        />
      </div>

      <div>
        <Label htmlFor="review-comment">Your review *</Label>
        <Textarea
          id="review-comment"
          name="comment"
          rows={4}
          maxLength={1000}
          defaultValue={values.comment}
          aria-invalid={Boolean(errors.comment)}
          required
        />
        <FieldError message={errors.comment?.[0]} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FormMessage ok={state.ok} message={state.message} />
        <SubmitButton variant="hazard" pendingLabel="Checking & publishing…" className="sm:ml-auto">
          Publish review
        </SubmitButton>
      </div>
    </form>
  );
}
