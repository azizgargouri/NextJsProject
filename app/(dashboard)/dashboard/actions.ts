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

/** generateText inside a Server Action (course ch.6) — drafts a reply in the claim thread. */
export async function suggestClaimMessageAction(claimId: string): Promise<ActionState> {
  try {
    const user = await requireActionUser(['CLIENT', 'MOVER']);
    const { result, source } = await claimsService.suggestMessage(user, claimId);
    logEvent({
      event: EventType.AI_REQUEST,
      userId: user.sub,
      method: 'ACTION',
      api: 'suggestClaimMessageAction',
      logInfo: { claimId, source },
    });
    return {
      ok: true,
      message: source === 'ai' ? 'AI reply suggestion ready' : 'Smart reply suggestion ready',
      suggestion: result,
    };
  } catch (error) {
    return failure(error);
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

/**
 * AI Smart Review Polisher & Auto-Scorer for clients on `/dashboard/reviews`.
 * Grounded strictly on:
 *  1) Any rough notes typed by the client,
 *  2) Any star ratings already clicked by the client, OR
 *  3) Actual MongoDB claims filed by the client on `moveReference`.
 * If none of the 3 exist, it refuses to guess and asks the client for input first.
 */
export async function polishClientReviewAction(input: {
  roughDraft: string;
  moveReference?: string;
  rating?: number;
  punctuality?: number;
  care?: number;
  communication?: number;
}): Promise<{
  ok: boolean;
  reason: string;
  polishedComment?: string;
  rating?: number;
  punctuality?: number;
  care?: number;
  communication?: number;
}> {
  const user = await requireActionUser(['CLIENT']);
  const text = input.roughDraft.trim();
  const moveRef = input.moveReference?.trim().toUpperCase();

  // Check if the client has any real claims recorded in MongoDB for this moveReference.
  const allClaims = await claimsService.listForParty(user, { page: 1, limit: 50, status: 'ALL' });
  const moveClaims = moveRef
    ? allClaims.data.filter((c) => c.moveReference?.toUpperCase() === moveRef)
    : [];

  const hasUserStars = Boolean(
    input.rating || input.punctuality || input.care || input.communication,
  );

  // If the client gave no text, clicked no stars, and has no claims on this move -> do NOT hallucinate!
  if (!text && !hasUserStars && moveClaims.length === 0) {
    return {
      ok: false,
      reason: `AI cannot guess how move ${moveRef || ''} went without evidence: no claims were found on this move, and you haven't clicked any stars or typed keywords yet. Pick your star rating or type a few words first!`,
    };
  }

  // Case 1: Grounded on real MongoDB claim(s) when text is empty
  if (!text && moveClaims.length > 0 && !hasUserStars) {
    const hasDelay = moveClaims.some((c) => c.category === 'DELAY');
    const hasDamage = moveClaims.some((c) => c.category === 'DAMAGE');
    const hasLoss = moveClaims.some((c) => c.category === 'LOSS');
    const hasBehavior = moveClaims.some((c) => c.category === 'BEHAVIOUR');
    const refs = moveClaims.map((c) => c.reference).join(', ');
    const subjects = moveClaims.map((c) => `"${c.subject}"`).join(' and ');

    const punctuality = hasDelay ? 1 : 4;
    const care = hasDamage || hasLoss ? 2 : 4;
    const communication = hasDelay || hasBehavior ? 2 : 4;
    const rating = Math.max(1, Math.min(5, Math.round((punctuality + care + communication) / 3)));

    const resolvedClaim = moveClaims.find((c) => c.status === 'RESOLVED' && c.resolution);
    const resolutionTail = resolvedClaim
      ? ` MoveUp support resolved claim ${resolvedClaim.reference} (${resolvedClaim.resolution?.amount ? `${resolvedClaim.resolution.amount} TND` : resolvedClaim.resolution?.outcome}).`
      : ` Claim ${refs} is currently logged with MoveUp support.`;

    return {
      ok: true,
      reason: `Grounded on ${moveClaims.length} MongoDB claim(s) filed for ${moveRef}: ${refs} (${subjects}).`,
      polishedComment: `Move ${moveRef} experienced an issue reported under ${refs}: ${moveClaims.map((c) => c.subject).join('; ')}.${resolutionTail}`,
      rating,
      punctuality,
      care,
      communication,
    };
  }

  // Case 2: Grounded on the user's rough draft and/or selected stars
  const lower = text.toLowerCase();
  const late = /late|retard|slow|wait|hour|heure/i.test(lower);
  const broken = /broke|broken|crack|scratch|damage|lost|missing|cass|abîm|perdu/i.test(lower);
  const rude = /rude|no call|sans prévenir|ignored|unprofessional/i.test(lower);
  const great = /great|excellent|perfect|professional|careful|on time|super|parfait|ponctuel/i.test(
    lower,
  );

  const baseStar = input.rating ?? (great ? 5 : late || broken || rude ? 2 : 4);
  const punctuality = input.punctuality ?? (late ? 2 : great ? 5 : baseStar);
  const care = input.care ?? (broken ? 2 : great ? 5 : baseStar);
  const communication = input.communication ?? (rude ? 2 : great ? 5 : baseStar);
  const rating =
    input.rating ?? Math.max(1, Math.min(5, Math.round((punctuality + care + communication) / 3)));

  let polishedComment = text;
  const moveTag = moveRef ? ` (${moveRef})` : '';

  if (!text && hasUserStars) {
    if (rating >= 4) {
      polishedComment = `Very satisfied with move${moveTag} (${rating}/5). Punctuality (${punctuality}/5), item care (${care}/5), and crew communication (${communication}/5) met our expectations.`;
    } else if (rating === 3) {
      polishedComment = `Mixed experience on move${moveTag} (${rating}/5). Punctuality was ${punctuality}/5, item care ${care}/5, and communication ${communication}/5.`;
    } else {
      polishedComment = `Disappointing experience on move${moveTag} (${rating}/5). Improvements are needed in punctuality (${punctuality}/5), item care (${care}/5), and communication (${communication}/5).`;
    }
  } else if (text.length < 140) {
    const parts: string[] = [text.charAt(0).toUpperCase() + text.slice(1).replace(/[.!?]*$/, '.')];
    if (late && !broken) {
      parts.push(
        `While the arrival window for the move${moveTag} experienced a delay, the crew handled our belongings once on site.`,
      );
    } else if (broken && !late) {
      parts.push(
        `Better protective wrapping is needed for fragile items during transit${moveTag}.`,
      );
    } else if (late && broken) {
      parts.push(
        `Both schedule punctuality and fragile-item protection during the move${moveTag} need improvement.`,
      );
    } else if (rating <= 2) {
      parts.push(
        `Service quality during move${moveTag} fell below expectations and requires follow-up.`,
      );
    } else {
      parts.push(
        `Overall a smooth experience${moveTag} with attentive handling from pickup to delivery.`,
      );
    }
    polishedComment = parts.join(' ');
  }

  return {
    ok: true,
    reason: text
      ? `Derived from your draft notes${hasUserStars ? ' + selected star ratings' : ''}.`
      : `Generated from the star ratings you selected (${rating}/5 overall).`,
    polishedComment,
    rating,
    punctuality,
    care,
    communication,
  };
}
