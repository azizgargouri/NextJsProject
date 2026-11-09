import { generateObject, generateText } from 'ai';
import {
  ClaimTriageSchema,
  DamageVisionSchema,
  ReviewModerationSchema,
  type ClaimTriage,
  type DamageVision,
  type ReviewModeration,
} from '../../../lib/quality/ai-schemas';
import type { AnalysisSource, ClaimCategory } from '../../shared/database/enums';
import { AI_LIMITS, aiModel, aiModelId, isAiEnabled, markAiFailure } from './ai.provider';
import { analyzeDamageByRules, moderateReviewByRules, triageClaimByRules } from './ai.fallback';

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
  // Open the quota circuit breaker so the next requests skip the cloud model for a while.
  markAiFailure(error);
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
      maxRetries: 0,
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
      maxRetries: 0,
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
      maxRetries: 0,
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

/**
 * generateText inside a Server Action (course ch.6) — drafts a constructive, de-escalating
 * message for either the CLIENT or the MOVER inside a claim's dispute thread.
 */
export async function suggestClaimThreadMessage(input: {
  actorRole: 'CLIENT' | 'MOVER';
  reference: string;
  category: ClaimCategory;
  subject: string;
  amountClaimed: number | null;
  visionSummary?: string | null;
  lastMessageText?: string | null;
}): Promise<Analysed<string>> {
  const amountNote = input.amountClaimed ? ` (${input.amountClaimed} TND claimed)` : '';
  const fallback =
    input.actorRole === 'CLIENT'
      ? `Hello MoveUp Support, following up on claim ${input.reference} regarding "${input.subject}"${amountNote}. ${
          input.visionSummary
            ? `The attached photo evidence and Vision AI scan confirm: ${input.visionSummary}`
            : 'All supporting details are attached in the file.'
        } Please let me know if you need any additional receipts or photos to finalize the settlement.`
      : `Hello, regarding claim ${input.reference} ("${input.subject}"), our crew has reviewed the delivery checklist and incident notes. We remain available to cooperate with MoveUp arbitration to reach a fair resolution${
          input.amountClaimed ? ` regarding the ${input.amountClaimed} TND estimate` : ''
        }.`;

  if (!isAiEnabled()) return { result: fallback, source: 'rules', model: null };

  try {
    const { text } = await generateText({
      model: aiModel(),
      maxRetries: 0,
      system:
        `You are an AI dispute communication coach on MoveUp (Tunisian moving platform). ` +
        `Write a concise, polite, factual 2-3 sentence message from the perspective of the ${input.actorRole} ` +
        `for claim ${input.reference}. Keep the tone constructive and de-escalating.`,
      prompt:
        `Category: ${input.category}\nSubject: ${input.subject}\n` +
        `Amount claimed: ${input.amountClaimed ?? 'N/A'} TND\n` +
        `Vision summary: ${input.visionSummary ?? 'none'}\n` +
        `Latest thread message: ${input.lastMessageText ?? 'none'}`,
      maxOutputTokens: 200,
      abortSignal: AbortSignal.timeout(AI_LIMITS.timeoutMs),
    });
    return { result: text.trim().slice(0, 800), source: 'ai', model: aiModelId() };
  } catch (error) {
    logAiFailure('claim thread reply suggestion', error);
    return { result: fallback, source: 'rules', model: null };
  }
}

/**
 * Optional local Ollama LLaVA vision pass when no cloud key is active and the user
 * uploads a photo without typing an item description hint.
 */
async function captionPhotosWithLocalLlava(images: string[]): Promise<string | null> {
  // Never attempt to contact localhost Ollama in test, serverless (Vercel / Lambda), or unless explicitly enabled
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !process.env.ENABLE_LOCAL_LLAVA
  ) {
    return null;
  }
  const base64Images = images
    .filter((img) => img.startsWith('data:image/') && !img.startsWith('data:image/svg+xml'))
    .slice(0, 4)
    .map((img) => img.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, ''));

  if (base64Images.length === 0) return null;

  try {
    const captions: string[] = [];
    for (const b64 of base64Images) {
      const res = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_VISION_MODEL || 'llava:7b',
          prompt:
            'In 4 to 7 words only, name the damaged household object and damage in this photo (for example: "broken ceramic plate", "scratched fabric sofa seat", "broken picture frame glass", "shattered television screen").',
          images: [b64],
          stream: false,
          options: { num_predict: 25, temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(1_500),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { response?: string };
      if (data.response?.trim()) {
        captions.push(data.response.trim().replace(/\.$/, ''));
      }
    }
    return captions.length > 0 ? captions.join(', ') : null;
  } catch {
    return null;
  }
}

/**
 * Multimodal Vision AI damage scanner (course ch.6 "Synthèse & Vision" + generateObject).
 * Inspects uploaded evidence photos with a multimodal LLM (Gemini 2.5 Flash / GPT-4o-mini / local LLaVA)
 * and grounds costs in the Tunisian market valuation & material physics engine.
 */
export async function analyzeClaimEvidencePhotos(input: {
  images: string[];
  hint?: string;
  presetId?: string;
  photoAnnotations?: { label?: string; roiCoveragePct?: number; boxCount?: number }[];
}): Promise<Analysed<DamageVision>> {
  const runGroundedFallback = async (): Promise<Analysed<DamageVision>> => {
    let effectiveHint = input.hint?.trim() || '';
    const hasPhotoLabels = (input.photoAnnotations ?? []).some((a) => Boolean(a.label?.trim()));
    let usedLocalVision = false;
    if (!effectiveHint && !hasPhotoLabels && !input.presetId && input.images.length > 0) {
      const llavaCaption = await captionPhotosWithLocalLlava(input.images);
      if (llavaCaption) {
        effectiveHint = llavaCaption;
        usedLocalVision = true;
      }
    }
    return {
      result: analyzeDamageByRules({
        hint: effectiveHint,
        presetId: input.presetId,
        imageCount: input.images.length,
        photoAnnotations: input.photoAnnotations,
      }),
      source: usedLocalVision ? 'ai' : 'rules',
      model: usedLocalVision ? 'llava:7b (local vision + TND physics)' : null,
    };
  };

  // If the user clicked a curated demo preset or cloud AI is disabled, use grounded vision + physics.
  if (input.presetId || !isAiEnabled()) {
    return runGroundedFallback();
  }

  try {
    const imageParts = input.images
      .filter((img) => img.startsWith('data:image/') || img.startsWith('http'))
      .slice(0, 3)
      .map((image) => ({ type: 'image' as const, image }));

    if (imageParts.length === 0) {
      return runGroundedFallback();
    }

    const { object } = await generateObject({
      model: aiModel(),
      schema: DamageVisionSchema,
      maxRetries: 0,
      system:
        'You are the Multimodal Vision AI Damage Inspector for MoveUp, a Tunisian moving-service platform. ' +
        'Inspect the attached moving damage photo(s). Identify the damaged furniture or household item(s), ' +
        'material, damage type, severity (NONE, MINOR, MODERATE, SEVERE, TOTAL_LOSS), whether it is repairable, ' +
        'and realistic repair or replacement costs in Tunisian Dinars (TND): ' +
        '1 ceramic plate/dish = 12 TND (repairable: false, TOTAL_LOSS); ' +
        'framed picture glass replacement = 45 TND (repairable: true, MODERATE); ' +
        'upholstered seat scratch/tear = 85 TND (repairable: true, MODERATE); ' +
        'broken TV/OLED screen = 950–1450 TND (repairable: false, TOTAL_LOSS); ' +
        'cracked tempered glass table = 450 TND (repairable: false, SEVERE). ' +
        'Also generate a concise claim subject and factual description ready to auto-fill the client claim form.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: input.hint?.trim()
                ? `Client note about the photo(s): ${input.hint.trim()}`
                : 'Inspect these move damage evidence photo(s) and return the structured assessment.',
            },
            ...imageParts,
          ],
        },
      ],
      maxOutputTokens: 600,
      abortSignal: AbortSignal.timeout(AI_LIMITS.timeoutMs),
    });

    return { result: object, source: 'ai', model: aiModelId() };
  } catch (error) {
    logAiFailure('damage vision analysis', error);
    return runGroundedFallback();
  }
}
