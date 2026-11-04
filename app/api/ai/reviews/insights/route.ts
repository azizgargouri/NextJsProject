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
  isAiEnabled,
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

    if (!isAiEnabled() || corpus.length === 0) {
      return new Response(JSON.stringify(insightsByRules(corpus)), {
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
    });
    return result.toTextStreamResponse();
  } catch (error) {
    return errorResponse(error);
  }
}
