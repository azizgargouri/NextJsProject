import { tool } from 'ai';
import { z } from 'zod';
import { connectMongo } from '../../shared/database/mongoose';
import { AiMessageModel, type AiMessageDoc } from '../../shared/database/models/ai-message.model';
import { UserModel } from '../../shared/database/models/user.model';
import { CLAIM_CATEGORIES, CLAIM_STATUSES, DAMAGE_SEVERITIES } from '../../shared/database/enums';
import type { SessionUser } from '../../shared/auth/session';
import { claimsService } from '../claims/claims.service';
import { reviewsRepository } from '../reviews/reviews.repository';
import { mediateClaimByRules } from './ai.fallback';

/**
 * MoveUp assistant: system prompt, tools and persistence (course ch.6 slides 14, 17, 19).
 * Tools are built PER USER so the model can only ever read that user's own records —
 * authorisation is enforced in code, never delegated to the prompt.
 */

export function systemPrompt(user: SessionUser): string {
  const roleHelp: Record<SessionUser['role'], string> = {
    CLIENT:
      'The user is a CLIENT. Help them follow their claims, estimate compensation with `estimateCompensation`, ' +
      'and choose a mover by looking at ratings.',
    MOVER:
      'The user is a MOVER (moving company). Help them follow claims opened against them, ' +
      'estimate dispute liability with `estimateCompensation`, and understand their rating.',
    ADMIN: 'The user is MoveUp staff. Give concise operational answers.',
  };
  return [
    'You are "MoveUp Assistant", the support assistant of MoveUp, a Tunisian moving-service platform.',
    roleHelp[user.role],
    `The user's name is ${user.name}.`,
    'Rules: answer in the language the user writes in (French, English or Tunisian Arabic). ',
    'Use the tools to read real data or calculate compensation — never invent claim references, statuses, prices or ratings.',
    'Never promise final refunds: explain that estimates are indicative until MoveUp staff issue a formal resolution.',
    'To open a claim with Vision AI photo scanning or write a review, point the user to the Claims or Reviews page of their workspace.',
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
        'Get the status, timeline, vision AI damage scan, and resolution of one claim by its reference (e.g. CLM-DEMO-0001).',
      inputSchema: z.object({ reference: z.string().min(5).max(40) }),
      execute: async ({ reference }) => {
        const claim = await claimsService.findByReferenceForActor(actor, reference);
        if (!claim) return { found: false };
        return {
          found: true,
          reference: claim.reference,
          status: claim.status,
          subject: claim.subject,
          amountClaimed: claim.amountClaimed,
          visionAnalysis: claim.visionAnalysis
            ? {
                overallSeverity: claim.visionAnalysis.overallSeverity,
                recommendedClaimAmountTnd: claim.visionAnalysis.recommendedClaimAmountTnd,
              }
            : null,
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

    estimateCompensation: tool({
      description:
        'Calculate an indicative MoveUp compensation and liability split in TND for a damaged/lost item or delay.',
      inputSchema: z.object({
        category: z.enum(CLAIM_CATEGORIES),
        itemDescription: z.string().min(3).max(160),
        claimedAmountTnd: z.number().min(0).max(50_000),
        severity: z.enum(DAMAGE_SEVERITIES).optional(),
      }),
      execute: async ({ category, itemDescription, claimedAmountTnd, severity }) => {
        const mediation = mediateClaimByRules({
          reference: 'ESTIMATE',
          category,
          priority: claimedAmountTnd >= 1000 ? 'HIGH' : 'MEDIUM',
          subject: itemDescription,
          description: itemDescription,
          amountClaimed: claimedAmountTnd,
          moverRatingAvg: 4.0,
          moverClaimsCount: 0,
          visionSeverity: severity ?? 'MODERATE',
          visionEstimatedCostTnd: claimedAmountTnd,
        });
        return {
          recommendedOutcome: mediation.recommendedOutcome,
          recommendedAmountTnd: mediation.recommendedAmountTnd,
          moverLiabilityPct: mediation.moverLiabilityPct,
          clientLiabilityPct: mediation.clientLiabilityPct,
          breakdown: mediation.compensationBreakdown,
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

/**
 * Smart Agentic Fallback when no cloud API key is configured:
 * executes the same scoped tools against real MongoDB records and returns
 * a realistic answer + tool call metadata so `useChat` works 100% live in demos.
 */
export async function answerChatByToolsFallback(
  user: SessionUser,
  question: string,
): Promise<{
  text: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput: unknown;
}> {
  const actor = { sub: user.sub, role: user.role };
  const q = question.trim();

  // 1. Check if the user mentions a specific claim reference (e.g. CLM-DEMO-0001)
  const refMatch = q.match(/CLM-[A-Z0-9-]+/i);
  if (refMatch) {
    const reference = refMatch[0].toUpperCase();
    const claim = await claimsService.findByReferenceForActor(actor, reference);
    if (!claim) {
      return {
        toolName: 'getClaimDetails',
        toolInput: { reference },
        toolOutput: { found: false },
        text: `I checked our records for **${reference}**, but no matching claim was found under your account.`,
      };
    }
    const visionLine = claim.visionAnalysis
      ? `\n- **Vision AI Assessment**: ${claim.visionAnalysis.overallSeverity} severity (recommended ${claim.visionAnalysis.recommendedClaimAmountTnd} TND)`
      : '';
    const resLine = claim.resolution
      ? `\n- **Resolution**: ${claim.resolution.outcome} (${claim.resolution.amount ?? 0} TND) — ${claim.resolution.note}`
      : '\n- **Resolution**: Pending MoveUp arbitration review.';
    return {
      toolName: 'getClaimDetails',
      toolInput: { reference },
      toolOutput: {
        found: true,
        reference: claim.reference,
        status: claim.status,
        subject: claim.subject,
        amountClaimed: claim.amountClaimed,
      },
      text:
        `Here is the live status for **${claim.reference}** (${claim.subject}):\n` +
        `- **Status**: ${claim.status}\n` +
        `- **Category**: ${claim.category} · **Claimed**: ${claim.amountClaimed ?? 0} TND` +
        visionLine +
        resLine,
    };
  }

  // 2. Check if the user asks for compensation / refund estimate
  if (
    /(compensat|indemn|refund|rembours|estimate|combien|how much|broken|cass[ée]|damage)/i.test(q)
  ) {
    const amountMatch = q.match(/(\d{2,5})\s*(tnd|dt|dinars?)?/i);
    const claimedAmountTnd = amountMatch ? Number(amountMatch[1]) : 450;
    const mediation = mediateClaimByRules({
      reference: 'ESTIMATE',
      category: 'DAMAGE',
      priority: claimedAmountTnd >= 1000 ? 'HIGH' : 'MEDIUM',
      subject: q.slice(0, 80),
      description: q,
      amountClaimed: claimedAmountTnd,
      moverRatingAvg: 4.2,
      moverClaimsCount: 1,
      visionSeverity: 'SEVERE',
      visionEstimatedCostTnd: claimedAmountTnd,
    });
    return {
      toolName: 'estimateCompensation',
      toolInput: {
        category: 'DAMAGE',
        itemDescription: q.slice(0, 80),
        claimedAmountTnd,
      },
      toolOutput: {
        recommendedOutcome: mediation.recommendedOutcome,
        recommendedAmountTnd: mediation.recommendedAmountTnd,
        moverLiabilityPct: mediation.moverLiabilityPct,
      },
      text:
        `Based on MoveUp Policy §9.3 and an estimated value of **${claimedAmountTnd} TND**:\n` +
        `- **Indicative Settlement**: **${mediation.recommendedAmountTnd} TND** (${mediation.recommendedOutcome.replace('_', ' ')})\n` +
        `- **Liability Split**: ${mediation.moverLiabilityPct}% Mover / ${mediation.clientLiabilityPct}% Client (after 10% wear & tear deduction)\n` +
        `- **Next Step**: Open a claim on the **Claims** page and attach a photo so our **Vision AI Scanner** can certify the damage.`,
    };
  }

  // 3. Check if the user asks about mover ratings / reviews
  if (/(rating|review|mover|déménageur|note|avis|best|meilleur)/i.test(q)) {
    await connectMongo();
    const movers = await UserModel.find({
      role: 'MOVER',
      status: 'ACTIVE',
      deletedAt: null,
    })
      .select('name')
      .limit(4)
      .lean<{ _id: unknown; name: string }[]>();
    const summaries = await Promise.all(
      movers.map(async (m) => ({
        name: m.name,
        ...(await reviewsRepository.summary(String(m._id))),
      })),
    );
    const lines = summaries.map(
      (m) =>
        `- **${m.name}**: ${m.average !== null ? `${m.average}/5` : 'No rating yet'} (${m.count} published review(s), care: ${m.care ?? '—'}/5, punctuality: ${m.punctuality ?? '—'}/5)`,
    );
    return {
      toolName: 'getMoverRating',
      toolInput: { moverName: 'all' },
      toolOutput: { movers: summaries },
      text:
        `Here are the current verified mover ratings on MoveUp:\n` +
        (lines.length ? lines.join('\n') : '- No active movers found.') +
        `\n\nYou can inspect full review breakdowns on the **Reviews** page.`,
    };
  }

  // 4. Default: list the user's claims from MongoDB
  const claims = await claimsService.briefForActor(actor);
  const lines = claims
    .slice(0, 5)
    .map(
      (c) =>
        `- **${c.reference}** (${c.status}) — *${c.subject}* [${c.category}]${
          c.resolution ? ` → ${c.resolution}` : ''
        }`,
    );
  return {
    toolName: 'listMyClaims',
    toolInput: {},
    toolOutput: { claims },
    text:
      claims.length > 0
        ? `Here are your ${claims.length} most recent claim(s):\n${lines.join('\n')}\n\nAsk me about any reference (e.g. **${claims[0]!.reference}**) or ask me to estimate compensation!`
        : `You currently have no open claims. To file a new dispute with **Multimodal Vision AI** photo scanning, head to **Claims → Open a claim**.`,
  };
}
