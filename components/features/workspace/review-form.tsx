'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ExternalLink, Sparkles, Truck } from 'lucide-react';
import { FieldError, Label } from '@/components/ui/field';
import { createReviewAction, polishClientReviewAction } from '@/app/(dashboard)/dashboard/actions';
import { initialActionState } from '@/lib/actions/action-state';
import type { CompletedMoveOption } from './claim-form';
import { FormMessage, NativeSelect, StarInput, SubmitButton, Textarea } from './workspace-ui';

/**
 * Client review of a mover — Server Action + useActionState + useFormStatus (course ch.5).
 * Lets the client pick from their completed moves list so moveReference & moverId link automatically.
 */
export function ReviewForm({
  movers,
  completedMoves = [],
}: {
  movers: { id: string; name: string }[];
  completedMoves?: CompletedMoveOption[];
}) {
  const [state, formAction] = useActionState(createReviewAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const [formKey, setFormKey] = useState(0);
  const errors = state.fieldErrors ?? {};
  const values = state.ok ? {} : (state.values ?? {});

  const defaultMove = completedMoves[0];
  const [selectedMoveRef, setSelectedMoveRef] = useState<string>(
    values.moveReference ?? defaultMove?.moveReference ?? '',
  );
  const [selectedMoverId, setSelectedMoverId] = useState<string>(
    values.moverId ?? defaultMove?.moverId ?? movers[0]?.id ?? '',
  );
  const [commentText, setCommentText] = useState<string>(values.comment ?? '');
  const [ratingVal, setRatingVal] = useState<number | undefined>(
    Number(values.rating) || undefined,
  );
  const [punctualityVal, setPunctualityVal] = useState<number | undefined>(
    Number(values.punctuality) || undefined,
  );
  const [careVal, setCareVal] = useState<number | undefined>(Number(values.care) || undefined);
  const [commVal, setCommVal] = useState<number | undefined>(
    Number(values.communication) || undefined,
  );
  const [aiBasis, setAiBasis] = useState<{ ok: boolean; reason: string } | null>(null);
  const [aiPolishing, startPolish] = useTransition();

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
      <input type="hidden" name="moveReference" value={selectedMoveRef} />

      {completedMoves.length > 0 ? (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="mono flex items-center gap-2 text-[11px] font-bold text-hazard">
              <Truck className="size-4" /> SELECT COMPLETED MOVE TO RATE *
            </p>
            {selectedMoveRef ? (
              <span className="mono border border-ink bg-ink px-2 py-0.5 text-[10px] font-bold text-paper">
                MOVE: {selectedMoveRef}
              </span>
            ) : null}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {completedMoves.map((move) => {
              const isSelected = selectedMoveRef === move.moveReference;
              return (
                <button
                  key={move.moveReference}
                  type="button"
                  onClick={() => {
                    setSelectedMoveRef(move.moveReference);
                    if (move.moverId) setSelectedMoverId(move.moverId);
                    setAiBasis(null);
                  }}
                  className={`flex flex-col justify-between border p-3.5 text-left transition-all ${
                    isSelected
                      ? 'border-2 border-hazard bg-hazard/[0.06] shadow-[3px_3px_0px_0px_#e53935]'
                      : 'border-ink bg-paper hover:bg-ink/[0.03]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`mono px-2 py-0.5 text-[10px] font-bold ${
                        isSelected ? 'bg-hazard text-paper' : 'border border-ink text-ink'
                      }`}
                    >
                      {move.moveReference}
                    </span>
                    <span className="mono text-[10px] text-ink-80">{move.completedDate}</span>
                  </div>
                  <p className="mt-2 text-xs font-bold">{move.route}</p>
                  <p className="mono mt-1 text-[10px] text-ink-80">MOVER: {move.moverName}</p>
                </button>
              );
            })}
          </div>
          <FieldError message={errors.moveReference?.[0]} />
        </div>
      ) : null}

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="review-mover">Mover (auto-linked from selected move) *</Label>
          {selectedMoverId ? (
            <Link
              href={`/movers/${selectedMoverId}`}
              className="mono inline-flex items-center gap-1 border border-hazard bg-hazard/10 px-2.5 py-1 text-[10px] font-bold text-hazard transition-colors hover:bg-hazard hover:text-paper"
            >
              VIEW MOVER PROFILE & AI SCORECARD <ExternalLink className="size-3" />
            </Link>
          ) : null}
        </div>
        <NativeSelect
          id="review-mover"
          name="moverId"
          value={selectedMoverId}
          onChange={(e) => setSelectedMoverId(e.target.value)}
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

      <StarInput
        name="rating"
        label="Overall rating"
        required
        defaultValue={ratingVal}
        onValueChange={setRatingVal}
        error={errors.rating?.[0]}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <StarInput
          name="punctuality"
          label="Punctuality"
          defaultValue={punctualityVal}
          onValueChange={setPunctualityVal}
        />
        <StarInput
          name="care"
          label="Care of items"
          defaultValue={careVal}
          onValueChange={setCareVal}
        />
        <StarInput
          name="communication"
          label="Communication"
          defaultValue={commVal}
          onValueChange={setCommVal}
        />
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="review-comment">Your review *</Label>
          <button
            type="button"
            disabled={aiPolishing}
            onClick={() =>
              startPolish(async () => {
                const res = await polishClientReviewAction({
                  roughDraft: commentText,
                  moveReference: selectedMoveRef,
                  rating: ratingVal,
                  punctuality: punctualityVal,
                  care: careVal,
                  communication: commVal,
                });
                setAiBasis({ ok: res.ok, reason: res.reason });
                if (res.ok && res.polishedComment) {
                  setCommentText(res.polishedComment);
                  setRatingVal(res.rating);
                  setPunctualityVal(res.punctuality);
                  setCareVal(res.care);
                  setCommVal(res.communication);
                }
              })
            }
            className="mono inline-flex items-center gap-1.5 border border-ink bg-paper px-2.5 py-1 text-[10px] font-bold text-ink transition-colors hover:border-hazard hover:text-hazard disabled:opacity-50"
          >
            <Sparkles className="size-3 text-hazard" />
            {aiPolishing ? 'CHECKING MOVE & POLISHING…' : 'AI POLISH & AUTO-SCORE STARS'}
          </button>
        </div>
        {aiBasis ? (
          <p
            className={`mono mb-2 border px-2.5 py-1.5 text-[10px] normal-case tracking-normal ${
              aiBasis.ok
                ? 'border-ink/40 bg-ink/[0.03] text-ink-80'
                : 'border-hazard bg-hazard/10 text-hazard'
            }`}
          >
            {aiBasis.ok ? `AI EVIDENCE BASIS: ${aiBasis.reason}` : aiBasis.reason}
          </p>
        ) : null}
        <Textarea
          id="review-comment"
          name="comment"
          rows={4}
          maxLength={1000}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write a few notes (e.g. 'Arrived on time and wrapped our glass table carefully') or click AI Polish & Auto-Score…"
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
