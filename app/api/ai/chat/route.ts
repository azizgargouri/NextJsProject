import { NextResponse } from 'next/server';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
} from 'ai';
import { errorResponse } from '@/server/shared/auth/guards';
import { requireSessionUser } from '@/server/shared/auth/session';
import { ValidationError } from '@/server/shared/database/errors';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import {
  AI_LIMITS,
  aiModel,
  aiModelId,
  answerChatByToolsFallback,
  assertChatQuota,
  buildTools,
  clearChatHistory,
  isAiAvailable,
  loadChatHistory,
  markAiFailure,
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
 * When no cloud LLM key is configured, falls back to the Smart Agentic Tool Stream so live
 * demos still show real tool calls and progressive token streaming over MongoDB data.
 */
export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request);
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

    if (!(await isAiAvailable())) {
      const fallback = await answerChatByToolsFallback(user, question);
      await saveChatMessage({
        userId: user.sub,
        role: 'assistant',
        content: fallback.text,
        tokens: Math.ceil(fallback.text.length / 4),
        model: 'rules-agent',
      });

      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          const toolCallId = `call_${Date.now()}`;
          writer.write({ type: 'start-step' });
          writer.write({
            type: 'tool-input-available',
            toolCallId,
            toolName: fallback.toolName,
            input: fallback.toolInput,
          });
          writer.write({
            type: 'tool-output-available',
            toolCallId,
            output: fallback.toolOutput,
          });
          writer.write({ type: 'finish-step' });
          writer.write({ type: 'start-step' });
          const textId = `txt_${Date.now()}`;
          writer.write({ type: 'text-start', id: textId });
          const words = fallback.text.split(/(\s+)/);
          for (const word of words) {
            if (!word) continue;
            writer.write({ type: 'text-delta', id: textId, delta: word });
            await new Promise((resolve) => setTimeout(resolve, 14));
          }
          writer.write({ type: 'text-end', id: textId });
          writer.write({ type: 'finish-step' });
        },
      });
      return createUIMessageStreamResponse({ stream });
    }

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
      onError: (error) => {
        markAiFailure(error);
        return 'Quota reached on cloud model — try your question again to use the instant local agent.';
      },
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
      enabled: true,
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
