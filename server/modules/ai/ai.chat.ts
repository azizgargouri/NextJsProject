import { tool } from 'ai';
import { z } from 'zod';
import { connectMongo } from '../../shared/database/mongoose';
import { AiMessageModel, type AiMessageDoc } from '../../shared/database/models/ai-message.model';
import { UserModel } from '../../shared/database/models/user.model';
import { CLAIM_STATUSES } from '../../shared/database/enums';
import type { SessionUser } from '../../shared/auth/session';
import { claimsService } from '../claims/claims.service';
import { reviewsRepository } from '../reviews/reviews.repository';

/**
 * MoveUp assistant: system prompt, tools and persistence (course ch.6 slides 14, 17, 19).
 * Tools are built PER USER so the model can only ever read that user's own records —
 * authorisation is enforced in code, never delegated to the prompt.
 */

export function systemPrompt(user: SessionUser): string {
  const roleHelp: Record<SessionUser['role'], string> = {
    CLIENT:
      'The user is a CLIENT. Help them follow their claims, understand the claim process, ' +
      'and choose a mover by looking at ratings.',
    MOVER:
      'The user is a MOVER (moving company). Help them follow claims opened against them and ' +
      'understand their rating. Encourage professional, calm replies.',
    ADMIN: 'The user is MoveUp staff. Give concise operational answers.',
  };
  return [
    'You are "MoveUp Assistant", the support assistant of MoveUp, a Tunisian moving-service platform.',
    roleHelp[user.role],
    `The user's name is ${user.name}.`,
    'Rules: answer in the language the user writes in (French, English or Tunisian Arabic). ',
    'Use the tools to read real data — never invent claim references, statuses, prices or ratings.',
    'Never promise refunds or compensation: only MoveUp staff decide outcomes.',
    'To open a claim or write a review, point the user to the Claims or Reviews page of their workspace.',
    'Keep answers short (max ~120 words) and use bullet points for lists.',
  ].join('\n');
}

export function buildTools(user: SessionUser) {
  const actor = { sub: user.sub, role: user.role };
  return {
    listMyClaims: tool({
      description:
        "List the user's most recent claims (clients: claims they opened; movers: claims about them).",
      inputSchema: z.object({
        status: z.enum(CLAIM_STATUSES).optional().describe('Optional status filter'),
      }),
      execute: async ({ status }) => ({ claims: await claimsService.briefForActor(actor, status) }),
    }),

    getClaimDetails: tool({
      description:
        'Get the status, timeline and resolution of one claim by its reference (e.g. CLM-261104-AB12).',
      inputSchema: z.object({ reference: z.string().min(5).max(40) }),
      execute: async ({ reference }) => {
        const claim = await claimsService.findByReferenceForActor(actor, reference);
        if (!claim) return { found: false };
        return {
          found: true,
          reference: claim.reference,
          status: claim.status,
          subject: claim.subject,
          resolution: claim.resolution,
          lastEvents: claim.timeline.slice(-4).map((event) => ({
            kind: event.kind,
            by: event.author?.name ?? event.authorRole,
            text: event.text,
            at: event.createdAt.slice(0, 10),
          })),
        };
      },
    }),

    getMoverRating: tool({
      description: 'Get the public rating summary of a mover by (part of) its name.',
      inputSchema: z.object({ moverName: z.string().min(2).max(60) }),
      execute: async ({ moverName }) => {
        const escaped = moverName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        await connectMongo();
        const movers = await UserModel.find({
          role: 'MOVER',
          status: 'ACTIVE',
          deletedAt: null,
          name: { $regex: escaped, $options: 'i' },
        })
          .select('name')
          .limit(3)
          .lean<{ _id: unknown; name: string }[]>();
        return {
          movers: await Promise.all(
            movers.map(async (mover) => ({
              name: mover.name,
              ...(await reviewsRepository.summary(String(mover._id))),
            })),
          ),
        };
      },
    }),
  };
}

/* ---------- persistence (history + token accounting) ---------- */

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export async function saveChatMessage(input: {
  userId: string;
  role: AiMessageDoc['role'];
  content: string;
  tokens?: number;
  model?: string | null;
}): Promise<void> {
  if (!input.content.trim()) return;
  await connectMongo();
  await AiMessageModel.create({
    userId: input.userId,
    role: input.role,
    content: input.content.slice(0, 8000),
    tokens: input.tokens ?? 0,
    model: input.model ?? null,
  });
}

export async function loadChatHistory(userId: string, take = 30): Promise<StoredChatMessage[]> {
  await connectMongo();
  const docs = await AiMessageModel.find({ userId })
    .sort({ createdAt: -1 })
    .limit(take)
    .lean<AiMessageDoc[]>();
  return docs.reverse().map((doc) => ({
    id: String(doc._id),
    role: doc.role,
    content: doc.content,
    createdAt: doc.createdAt.toISOString(),
  }));
}

export async function clearChatHistory(userId: string): Promise<void> {
  await connectMongo();
  await AiMessageModel.deleteMany({ userId });
}

/** Token usage for the admin overview (course ch.6: "Enregistre usage.totalTokens par requête"). */
export async function aiUsageStats() {
  await connectMongo();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [row] = await AiMessageModel.aggregate<{
    tokens: number;
    messages: number;
    users: string[];
  }>([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: null,
        tokens: { $sum: '$tokens' },
        messages: { $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] } },
        users: { $addToSet: '$userId' },
      },
    },
  ]);
  return {
    tokensLast30Days: row?.tokens ?? 0,
    questionsLast30Days: row?.messages ?? 0,
    activeUsers: row?.users.length ?? 0,
  };
}
