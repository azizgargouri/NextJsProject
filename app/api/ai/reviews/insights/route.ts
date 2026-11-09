export const dynamic = 'force-dynamic';

import { streamObject } from 'ai';
import { errorResponse } from '@/server/shared/auth/guards';
import { requireSessionUser } from '@/server/shared/auth/session';
import { parseBody } from '@/server/shared/http/validate';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import { ReviewInsightsSchema } from '@/lib/quality/ai-schemas';
import { ReviewInsightsRequestSchema, reviewsService } from '@/server/modules/reviews';
import {
  AI_LIMITS,
  aiModel,
  insightsByRules,
  insightsPrompt,
  isAiAvailable,
  markAiFailure,
} from '@/server/modules/ai';

export const maxDuration = 30;

/**
 * POST /api/ai/reviews/insights — staff-only, consumed by `useObject`.
 * streamObject sends a JSON object that fills in progressively (headline, then lists).
 */
export async function POST(request: Request) {
  try {
    const actor = await requireSessionUser(request, ['ADMIN']);
    const { moverId } = await parseBody(request, ReviewInsightsRequestSchema);
    const corpus = await reviewsService.corpusForInsights(moverId);

    logEvent({
      event: EventType.AI_REQUEST,
      userId: actor.sub,
      method: 'POST',
      api: '/api/ai/reviews/insights',
    });

    if (!(await isAiAvailable()) || corpus.length === 0) {
      const json = JSON.stringify(insightsByRules(corpus));
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
      schema: ReviewInsightsSchema,
      system: 'You are a customer-experience analyst for a moving-service marketplace.',
      prompt: insightsPrompt(corpus),
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
