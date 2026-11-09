'use client';

import { useActionState, useEffect, useRef } from 'react';
import { postClaimMessageAction } from '@/app/(dashboard)/dashboard/actions';
import { initialActionState } from '@/lib/actions/action-state';
import { FieldError, Label } from '@/components/ui/field';
import { FormMessage, SubmitButton, Textarea } from './workspace-ui';

/** Reply in the claim thread. The claim id is bound server-side via .bind (not a hidden input). */
export function ClaimMessageForm({ claimId }: { claimId: string }) {
  const action = postClaimMessageAction.bind(null, claimId);
  const [state, formAction] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <Label htmlFor="claim-message">Add a message</Label>
      <Textarea
        id="claim-message"
        name="text"
        rows={3}
        maxLength={1000}
        placeholder="Add details, answer a question from support…"
        defaultValue={state.ok ? '' : state.values?.text}
        aria-invalid={Boolean(state.fieldErrors?.text)}
        required
      />
      <FieldError message={state.fieldErrors?.text?.[0]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormMessage ok={state.ok} message={state.message} />
        <SubmitButton size="sm" className="ml-auto">
          Send
        </SubmitButton>
      </div>
    </form>
  );
}
