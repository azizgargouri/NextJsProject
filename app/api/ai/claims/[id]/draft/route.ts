import { streamText } from 'ai';
import { errorResponse } from '@/server/shared/auth/guards';
import { requireSessionUser } from '@/server/shared/auth/session';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import { claimsService } from '@/server/modules/claims';
import {
  AI_LIMITS,
  aiModel,
  claimDraftByTemplate,
  claimDraftPrompt,
  isAiAvailable,
  markAiFailure,
} from '@/server/modules/ai';

export const maxDuration = 30;

/**
 * POST /api/ai/claims/:id/draft — staff-only, consumed by `useCompletion` (text protocol).
 * Streams a resolution message the agent edits before sending. Without a key it returns
 * a template as plain text, which the same hook renders unchanged.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser(request, ['ADMIN']);
    const { id } = await params;
    const claim = await claimsService.getForActor(actor, id);
    const body = (await request.json().catch(() => null)) as { prompt?: string } | null;
    const instruction = typeof body?.prompt === 'string' ? body.prompt.slice(0, 500) : undefined;

    logEvent({
      event: EventType.AI_REQUEST,
      userId: actor.sub,
      method: 'POST',
      api: `/api/ai/claims/${id}/draft`,
      logInfo: { claimId: id },
    });

    if (!(await isAiAvailable())) {
      const text = claimDraftByTemplate(claim);
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const words = text.split(/(\s+)/);
          for (const word of words) {
            if (!word) continue;
            controller.enqueue(encoder.encode(word));
            await new Promise((resolve) => setTimeout(resolve, 18));
          }
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const result = streamText({
      model: aiModel(),
      maxRetries: 0,
      system:
        'You are a senior customer-care agent at MoveUp (Tunisia). You draft resolution messages. ' +
        "Write in the client's language (from the claim text).",
      prompt: claimDraftPrompt(claim, instruction),
      maxOutputTokens: 400,
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
