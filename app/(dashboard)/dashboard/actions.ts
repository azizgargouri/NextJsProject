'use server';

/**
 * Server Actions for the client / mover workspace (course ch.5).
 * Forms post their FormData straight here — no API route, no useState per field.
 * Every action: authenticate (httpOnly cookie) → validate (Zod) → call the service →
 * audit → revalidate the affected pages → return a serialisable state for useActionState.
 */
import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { requireActionUser } from '@/server/shared/auth/session';
import { DomainError, ValidationError } from '@/server/shared/database/errors';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import { ClaimCreateSchema, ClaimMessageSchema, claimsService } from '@/server/modules/claims';
import { ReviewCreateSchema, ReviewReplySchema, reviewsService } from '@/server/modules/reviews';
import type { ActionState } from '@/lib/actions/action-state';

function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === 'string' && !key.startsWith('$')) values[key] = value;
  });
  return values;
}

function validate<S extends z.ZodType>(schema: S, formData: FormData): z.output<S> {
  const parsed = schema.safeParse(formValues(formData));
  if (!parsed.success)
    throw new ValidationError('Please fix the highlighted fields', parsed.error.flatten());
  return parsed.data;
}

function failure(error: unknown, formData?: FormData): ActionState {
  const values = formData ? formValues(formData) : undefined;
  if (error instanceof ValidationError) {
    const details = error.details as { fieldErrors?: Record<string, string[]> } | undefined;
    return { ok: false, message: error.message, fieldErrors: details?.fieldErrors, values };
  }
  if (error instanceof DomainError) return { ok: false, message: error.message, values };
  console.error('[action] unexpected error', error);
  return { ok: false, message: 'Something went wrong. Please try again.', values };
}

/* ---------------- claims ---------------- */

export async function createClaimAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireActionUser(['CLIENT']);
    const claim = await claimsService.create(user, validate(ClaimCreateSchema, formData));
    logEvent({
      event: EventType.CLAIM_CREATE,
      userId: user.sub,
      method: 'ACTION',
      api: 'createClaimAction',
      logInfo: { claimId: claim.id, reference: claim.reference },
    });
    revalidatePath('/dashboard/claims');
    return {
      ok: true,
      message: `Claim ${claim.reference} submitted. Our team will get back to you.`,
      redirectTo: `/dashboard/claims/${claim.id}`,
    };
  } catch (error) {
    return failure(error, formData);
  }
}

/** Bound with `.bind(null, claimId)` in the page so the id never travels in a hidden field. */
export async function postClaimMessageAction(
  claimId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireActionUser(['CLIENT', 'MOVER']);
    await claimsService.addMessage(user, claimId, validate(ClaimMessageSchema, formData));
    logEvent({
      event: EventType.CLAIM_MESSAGE,
      userId: user.sub,
      method: 'ACTION',
      api: 'postClaimMessageAction',
      logInfo: { claimId },
    });
    revalidatePath(`/dashboard/claims/${claimId}`);
    return { ok: true, message: 'Message sent' };
  } catch (error) {
    return failure(error, formData);
  }
}

/* ---------------- reviews ---------------- */

export async function createReviewAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireActionUser(['CLIENT']);
    const review = await reviewsService.create(user, validate(ReviewCreateSchema, formData));
    logEvent({
      event: EventType.REVIEW_CREATE,
      userId: user.sub,
      method: 'ACTION',
      api: 'createReviewAction',
      logInfo: { reviewId: review.id, status: review.status },
    });
    revalidatePath('/dashboard/reviews');
    return {
      ok: true,
      message:
        review.status === 'FLAGGED'
          ? 'Thanks! Your review is waiting for a quick check by our team before it is published.'
          : 'Thanks! Your review is now published.',
    };
  } catch (error) {
    return failure(error, formData);
  }
}

export async function replyToReviewAction(
  reviewId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireActionUser(['MOVER']);
    await reviewsService.reply(user, reviewId, validate(ReviewReplySchema, formData));
    logEvent({
      event: EventType.REVIEW_REPLY,
      userId: user.sub,
      method: 'ACTION',
      api: 'replyToReviewAction',
      logInfo: { reviewId },
    });
    revalidatePath('/dashboard/reviews');
    return { ok: true, message: 'Reply published' };
  } catch (error) {
    return failure(error, formData);
  }
}

/** generateText inside a Server Action (course ch.6: "Idéal pour … Server Actions"). */
export async function suggestReplyAction(reviewId: string): Promise<ActionState> {
  try {
    const user = await requireActionUser(['MOVER']);
    const { result, source } = await reviewsService.suggestReply(user, reviewId);
    logEvent({
      event: EventType.AI_REQUEST,
      userId: user.sub,
      method: 'ACTION',
      api: 'suggestReplyAction',
      logInfo: { reviewId, source },
    });
    return {
      ok: true,
      message: source === 'ai' ? 'AI suggestion ready' : 'Template suggestion ready',
      suggestion: result,
    };
  } catch (error) {
    return failure(error);
  }
}
