'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Label } from '@/components/ui/field';
import { replyToReviewAction, suggestReplyAction } from '@/app/(dashboard)/dashboard/actions';
import { initialActionState } from '@/lib/actions/action-state';
import { FormMessage, SubmitButton, Textarea } from './workspace-ui';

/**
 * Mover public reply. "Suggest" calls a Server Action that runs generateText on the server
 * (course ch.6) — the API key never reaches the browser. useTransition keeps the UI responsive.
 */
export function ReviewReplyForm({ reviewId, existing }: { reviewId: string; existing?: string }) {
  const [state, formAction] = useActionState(
    replyToReviewAction.bind(null, reviewId),
    initialActionState,
  );
  const [draft, setDraft] = useState(existing ?? '');
  const [hint, setHint] = useState('');
  const [suggesting, startSuggest] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);

  const suggest = () =>
    startSuggest(async () => {
      const result = await suggestReplyAction(reviewId);
      if (result.suggestion) {
        setDraft(result.suggestion);
        textRef.current?.focus();
      }
      setHint(result.message);
    });

  return (
    <form action={formAction} className="mt-4 space-y-3 border-t border-ink pt-4">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`reply-${reviewId}`} className="pb-0">
          {existing ? 'Edit your public reply' : 'Reply publicly'}
        </Label>
        <Button type="button" variant="ghost" size="sm" onClick={suggest} disabled={suggesting}>
          <Sparkles /> {suggesting ? 'Writing…' : 'Suggest a reply'}
        </Button>
      </div>
      <Textarea
        ref={textRef}
        id={`reply-${reviewId}`}
        name="text"
        rows={3}
        maxLength={600}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        aria-invalid={Boolean(state.fieldErrors?.text)}
        required
      />
      <FieldError message={state.fieldErrors?.text?.[0]} />
      {hint && !state.message ? (
        <p className="mono text-[10px] text-ink-40">{hint} — review it before posting.</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormMessage ok={state.ok} message={state.message} />
        <SubmitButton size="sm" className="ml-auto">
          Post reply
        </SubmitButton>
      </div>
    </form>
  );
}
