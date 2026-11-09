'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import {
  postClaimMessageAction,
  suggestClaimMessageAction,
} from '@/app/(dashboard)/dashboard/actions';
import { initialActionState } from '@/lib/actions/action-state';
import { Button } from '@/components/ui/button';
import { FieldError, Label } from '@/components/ui/field';
import { FormMessage, SubmitButton, Textarea } from './workspace-ui';

/**
 * Reply in the claim thread. Includes a 1-click "Suggest AI reply" button powered by
 * `generateText` inside a Server Action (course ch.6).
 */
export function ClaimMessageForm({ claimId }: { claimId: string }) {
  const action = postClaimMessageAction.bind(null, claimId);
  const [state, formAction] = useActionState(action, initialActionState);
  const [draft, setDraft] = useState('');
  const [hint, setHint] = useState('');
  const [suggesting, startSuggest] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.ok) {
      setDraft('');
      setHint('');
    }
  }, [state]);

  const handleSuggest = () =>
    startSuggest(async () => {
      const res = await suggestClaimMessageAction(claimId);
      if (res.suggestion) {
        setDraft(res.suggestion);
        textRef.current?.focus();
      }
      setHint(res.message);
    });

  return (
    <form action={formAction} className="space-y-3 border border-ink bg-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="claim-message" className="pb-0">
          Add a message to the dossier
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSuggest}
          disabled={suggesting}
        >
          <Sparkles className="size-3.5 text-hazard" />{' '}
          {suggesting ? 'Drafting…' : 'Suggest AI reply'}
        </Button>
      </div>
      <Textarea
        ref={textRef}
        id="claim-message"
        name="text"
        rows={3}
        maxLength={1000}
        placeholder="Add details, answer a question from support or the mover…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-invalid={Boolean(state.fieldErrors?.text)}
        required
      />
      <FieldError message={state.fieldErrors?.text?.[0]} />
      {hint && !state.message ? (
        <p className="mono text-[10px] text-ink-80">{hint} — you can edit before sending.</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormMessage ok={state.ok} message={state.message} />
        <SubmitButton size="sm" className="ml-auto">
          Send message
        </SubmitButton>
      </div>
    </form>
  );
}
