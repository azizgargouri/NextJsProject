import { connectMongo } from '../../shared/database/mongoose';
import { AiMessageModel } from '../../shared/database/models/ai-message.model';
import { DomainError } from '../../shared/database/errors';
import { AI_LIMITS } from './ai.provider';

export class AiRateLimitError extends DomainError {
  constructor(limit: number) {
    super(
      `AI assistant limit reached (${limit} messages per hour). Try again later.`,
      429,
      'AI_RATE_LIMITED',
    );
  }
}

export class AiUnavailableError extends DomainError {
  constructor() {
    super('The AI assistant is not configured on this server.', 503, 'AI_UNAVAILABLE');
  }
}

/**
 * Rolling one-hour window counted from MongoDB (course ch.6 "Rate limiting").
 * Stored state means the limit holds across server restarts and multiple instances.
 */
export async function assertChatQuota(userId: string): Promise<{ used: number; limit: number }> {
  await connectMongo();
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const used = await AiMessageModel.countDocuments({
    userId,
    role: 'user',
    createdAt: { $gte: since },
  });
  if (used >= AI_LIMITS.chatPerHour) throw new AiRateLimitError(AI_LIMITS.chatPerHour);
  return { used, limit: AI_LIMITS.chatPerHour };
}
