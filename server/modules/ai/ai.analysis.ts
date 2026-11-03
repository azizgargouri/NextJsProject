import { generateObject, generateText } from 'ai';
import {
  ClaimTriageSchema,
  ReviewModerationSchema,
  type ClaimTriage,
  type ReviewModeration,
} from '../../../lib/quality/ai-schemas';
import type { AnalysisSource, ClaimCategory } from '../../shared/database/enums';
import { AI_LIMITS, aiModel, aiModelId, isAiEnabled } from './ai.provider';
import { moderateReviewByRules, triageClaimByRules } from './ai.fallback';

/**
 * AI SDK Core, server side (course ch.6 slide 11):
 *  - generateObject + Zod → typed JSON we can store straight into MongoDB
 *  - generateText         → blocking text, ideal inside a Server Action
 * Each function degrades to the rule engine so a missing key or a provider outage
 * never blocks a client from filing a claim or a review.
 */

export interface Analysed<T> {
  result: T;
  source: AnalysisSource;
  model: string | null;
}

function logAiFailure(feature: string, error: unknown) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      `[ai] ${feature} fell back to rules:`,
      error instanceof Error ? error.message : error,
    );
  }
}

export async function triageClaim(input: {
  subject: string;
  description: string;
  amountClaimed: number | null;
  category: ClaimCategory;
}): Promise<Analysed<ClaimTriage>> {
  if (!isAiEnabled()) return { result: triageClaimByRules(input), source: 'rules', model: null };

  try {
    const { object } = await generateObject({
      model: aiModel(),
      schema: ClaimTriageSchema,
      system:
        'You are the claims triage assistant of MoveUp, a Tunisian moving company. ' +
        'Classify the client claim. Be neutral: never promise compensation. ' +
        'Write summary and suggestedAction in the same language as the claim.',
      prompt:
        `Client-selected category: ${input.category}\n` +
        `Amount claimed (TND): ${input.amountClaimed ?? 'none'}\n` +
        `Subject: ${input.subject}\n` +
        `Description:\n${input.description}`,
      maxOutputTokens: 400,
      abortSignal: AbortSignal.timeout(AI_LIMITS.timeoutMs),
    });
    return { result: object, source: 'ai', model: aiModelId() };
  } catch (error) {
    logAiFailure('claim triage', error);
    return { result: triageClaimByRules(input), source: 'rules', model: null };
  }
}

export async function moderateReview(input: {
  comment: string;
  rating: number;
}): Promise<Analysed<ReviewModeration>> {
  // Hard rules always run: an LLM must never be able to publish a phone number.
  const rules = moderateReviewByRules(input);
  if (!isAiEnabled()) return { result: rules, source: 'rules', model: null };

  try {
    const { object } = await generateObject({
      model: aiModel(),
      schema: ReviewModerationSchema,
      system:
        'You moderate customer reviews of moving companies. Negative but honest reviews are ' +
        'NOT toxic. Flag only insults, threats, hate speech, personal data or spam.',
      prompt: `Rating: ${input.rating}/5\nReview:\n${input.comment}`,
      maxOutputTokens: 300,
      abortSignal: AbortSignal.timeout(AI_LIMITS.timeoutMs),
    });
    return {
      result: {
        ...object,
        toxic: object.toxic || rules.toxic,
        reasons: [...new Set([...object.reasons, ...rules.reasons])].slice(0, 5),
      },
      source: 'ai',
      model: aiModelId(),
    };
  } catch (error) {
    logAiFailure('review moderation', error);
    return { result: rules, source: 'rules', model: null };
  }
}

/** generateText (blocking) — a polite draft reply a mover can edit before posting. */
export async function suggestMoverReply(input: {
  moverName: string;
  rating: number;
  comment: string;
}): Promise<Analysed<string>> {
  const fallback =
    input.rating >= 4
      ? `Thank you for your trust and for taking the time to review ${input.moverName}. We are glad your move went well!`
      : `Thank you for your feedback. We are sorry the move did not meet your expectations — our team will contact you to understand what happened and make it right.`;
  if (!isAiEnabled()) return { result: fallback, source: 'rules', model: null };

  try {
    const { text } = await generateText({
      model: aiModel(),
      system:
        `You write short, professional public replies for the moving company "${input.moverName}". ` +
        'Max 3 sentences, same language as the review, no promises of money, no personal data.',
      prompt: `Rating: ${input.rating}/5\nReview: ${input.comment}`,
      maxOutputTokens: 200,
      abortSignal: AbortSignal.timeout(AI_LIMITS.timeoutMs),
    });
    return { result: text.trim().slice(0, 600), source: 'ai', model: aiModelId() };
  } catch (error) {
    logAiFailure('mover reply', error);
    return { result: fallback, source: 'rules', model: null };
  }
}
