import { NextResponse } from 'next/server';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { errorResponse } from '@/server/shared/auth/guards';
import { requireSessionUser } from '@/server/shared/auth/session';
import { ValidationError } from '@/server/shared/database/errors';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import {
  AI_LIMITS,
  AiUnavailableError,
  aiModel,
  aiModelId,
  assertChatQuota,
  buildTools,
  clearChatHistory,
  isAiEnabled,
  loadChatHistory,
  saveChatMessage,
  systemPrompt,
} from '@/server/modules/ai';

/** Streaming responses can run longer than a normal request. */
export const maxDuration = 30;

function textOf(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')
    .trim();
}

/**
 * POST /api/ai/chat — called by `useChat` (course ch.6 "Étape 1: Route Handler de streaming").
 * streamText + tools (multi-step) → UI message stream; onFinish persists the answer in MongoDB.
 */
export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request);
    if (!isAiEnabled()) throw new AiUnavailableError();
    await assertChatQuota(user.sub);

    const body = (await request.json().catch(() => null)) as { messages?: UIMessage[] } | null;
    const messages = Array.isArray(body?.messages)
      ? body.messages.slice(-AI_LIMITS.historyWindow)
      : [];
    const last = messages.at(-1);
    const question = last && last.role === 'user' ? textOf(last) : '';
    if (!question) throw new ValidationError('Send a question to the assistant');
    if (question.length > 2000)
      throw new ValidationError('Question too long (2000 characters max)');

    await saveChatMessage({ userId: user.sub, role: 'user', content: question });
    logEvent({
      event: EventType.AI_REQUEST,
      userId: user.sub,
      method: 'POST',
      api: '/api/ai/chat',
    });

    const result = streamText({
      model: aiModel(),
      system: systemPrompt(user),
      messages: await convertToModelMessages(messages),
      tools: buildTools(user),
      // Tool loop: the model may call a tool, read the result, then write the answer.
      stopWhen: stepCountIs(4),
      maxOutputTokens: AI_LIMITS.maxOutputTokens,
      abortSignal: AbortSignal.timeout(AI_LIMITS.timeoutMs),
      onFinish: async ({ text, totalUsage }) => {
        await saveChatMessage({
          userId: user.sub,
          role: 'assistant',
          content: text,
          tokens: totalUsage?.totalTokens ?? 0,
          model: aiModelId(),
        });
      },
    });

    return result.toUIMessageStreamResponse({
      onError: () => 'The assistant could not answer right now. Please try again in a moment.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** GET /api/ai/chat — saved history (restores the conversation on another device). */
export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    return NextResponse.json({
      enabled: isAiEnabled(),
      limitPerHour: AI_LIMITS.chatPerHour,
      messages: await loadChatHistory(user.sub),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/ai/chat — "clear conversation". */
export async function DELETE(request: Request) {
  try {
    const user = await requireSessionUser(request);
    await clearChatHistory(user.sub);
    return NextResponse.json({ message: 'Conversation cleared' });
  } catch (error) {
    return errorResponse(error);
  }
}
