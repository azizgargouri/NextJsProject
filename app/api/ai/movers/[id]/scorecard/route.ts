import { streamObject } from 'ai';
import { errorResponse } from '@/server/shared/auth/guards';
import { MoverScorecardSchema } from '@/lib/quality/ai-schemas';
import { claimsService } from '@/server/modules/claims';
import { reviewsService } from '@/server/modules/reviews';
import {
  AI_LIMITS,
  aiModel,
  isAiAvailable,
  markAiFailure,
  moverScorecardByRules,
  moverScorecardPrompt,
} from '@/server/modules/ai';

export const maxDuration = 30;

/**
 * POST /api/ai/movers/:id/scorecard — Public AI Mover Trust & Reliability Scorecard.
 * Consumed by `useObject` on `/movers/[id]` (course ch.6 "streamObject + useObject").
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [profile, claimsCount] = await Promise.all([
      reviewsService.moverProfile(id),
      claimsService.countForMover(id),
    ]);

    const input = {
      moverName: profile.mover.name,
      summary: profile.summary,
      claimsCount,
      comments: profile.latest.map((r) => ({ rating: r.rating, comment: r.comment })),
    };

    if (!(await isAiAvailable())) {
      const scorecard = moverScorecardByRules(input);
      const json = JSON.stringify(scorecard);
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const chunkSize = 24;
          for (let i = 0; i < json.length; i += chunkSize) {
            controller.enqueue(encoder.encode(json.slice(i, i + chunkSize)));
            await new Promise((resolve) => setTimeout(resolve, 16));
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
      schema: MoverScorecardSchema,
      system:
        'You are the MoveUp Trust & Quality Analyst. Synthesize verified customer reviews and dispute history into an objective Mover Scorecard.',
      prompt: moverScorecardPrompt(input),
      maxOutputTokens: AI_LIMITS.maxOutputTokens,
      abortSignal: AbortSignal.timeout(AI_LIMITS.timeoutMs),
      onError: ({ error }) => {
        markAiFailure(error);
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    return errorResponse(error);
  }
}

