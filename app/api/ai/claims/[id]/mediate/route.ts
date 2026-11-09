import { streamObject } from 'ai';
import { errorResponse } from '@/server/shared/auth/guards';
import { requireSessionUser } from '@/server/shared/auth/session';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import { ClaimMediationSchema } from '@/lib/quality/ai-schemas';
import { claimsService } from '@/server/modules/claims';
import { reviewsRepository } from '@/server/modules/reviews/reviews.repository';
import {
  AI_LIMITS,
  aiModel,
  aiModelId,
  claimMediationPrompt,
  isAiAvailable,
  markAiFailure,
  mediateClaimByRules,
} from '@/server/modules/ai';

export const maxDuration = 30;

/**
 * POST /api/ai/claims/:id/mediate — AI Dispute Mediator & Compensation Calculator.
 * Staff-only endpoint consumed by `useObject` (course ch.6 "streamObject + useObject").
 * Cross-references client claim, Vision AI photo evidence, mover rating/claim history,
 * and MoveUp policy rules to stream a structured compensation & liability proposal.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser(request, ['ADMIN']);
    const { id } = await params;
    const claim = await claimsService.getForActor(actor, id);

    const [moverSummary, moverClaimsCount] = claim.mover
      ? await Promise.all([
          reviewsRepository.summary(claim.mover.id),
          claimsService.countForMover(claim.mover.id),
        ])
      : [{ average: null }, 0];

    logEvent({
      event: EventType.AI_REQUEST,
      userId: actor.sub,
      method: 'POST',
      api: `/api/ai/claims/${id}/mediate`,
      logInfo: { claimId: id, reference: claim.reference },
    });

    if (!(await isAiAvailable())) {
      const ruleMediation = mediateClaimByRules({
        reference: claim.reference,
        category: claim.category,
        priority: claim.priority ?? 'MEDIUM',
        subject: claim.subject,
        description: claim.description,
        amountClaimed: claim.amountClaimed,
        moverRatingAvg: moverSummary.average,
        moverClaimsCount,
        visionSeverity: claim.visionAnalysis?.overallSeverity ?? null,
        visionEstimatedCostTnd: claim.visionAnalysis?.recommendedClaimAmountTnd ?? null,
      });

      await claimsService.saveMediation(id, {
        ...ruleMediation,
        source: 'rules',
        model: null,
        generatedAt: new Date(),
      });

      // Stream the JSON progressively so `useObject` animates the fields filling in live!
      const json = JSON.stringify(ruleMediation);
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const chunkSize = 28;
          for (let i = 0; i < json.length; i += chunkSize) {
            controller.enqueue(encoder.encode(json.slice(i, i + chunkSize)));
            await new Promise((resolve) => setTimeout(resolve, 18));
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const result = streamObject({
      model: aiModel(),
      schema: ClaimMediationSchema,
      system:
        'You are the Senior Dispute Arbitrator & Compensation Calculator for MoveUp (Tunisia). ' +
        'Evaluate the claim objectively using the client statement, Vision AI evidence, mover history, ' +
        'and MoveUp Specification Book rules. Ensure clientLiabilityPct + moverLiabilityPct = 100.',
      prompt: claimMediationPrompt(claim, {
        ratingAvg: moverSummary.average,
        claimsCount: moverClaimsCount,
      }),
      maxOutputTokens: AI_LIMITS.maxOutputTokens,
      abortSignal: AbortSignal.timeout(AI_LIMITS.timeoutMs),
      onError: ({ error }) => {
        markAiFailure(error);
      },
      onFinish: async ({ object }) => {
        if (object) {
          await claimsService.saveMediation(id, {
            ...object,
            source: 'ai',
            model: aiModelId(),
            generatedAt: new Date(),
          });
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    return errorResponse(error);
  }
}
