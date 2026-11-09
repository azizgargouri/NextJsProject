import { z } from 'zod';
import { CLAIM_CATEGORIES, CLAIM_PRIORITIES, REVIEW_TOPICS, SENTIMENTS } from './constants';

/**
 * Zod contracts for structured AI output (course ch.6 — generateObject / streamObject).
 * Shared by the server (forces the LLM to return this exact JSON shape) and the
 * client (`useObject` parses the partial stream against the same schema).
 */

export const ClaimTriageSchema = z.object({
  category: z.enum(CLAIM_CATEGORIES).describe('Best matching claim category'),
  priority: z
    .enum(CLAIM_PRIORITIES)
    .describe('URGENT only for safety issues or very high value; LOW for minor annoyances'),
  summary: z.string().max(280).describe('One or two neutral sentences summarising the claim'),
  suggestedAction: z.string().max(400).describe('Concrete next step for the MoveUp support agent'),
  sentiment: z.enum(SENTIMENTS),
  confidence: z.number().min(0).max(1),
});
export type ClaimTriage = z.infer<typeof ClaimTriageSchema>;

export const ReviewModerationSchema = z.object({
  sentiment: z.enum(SENTIMENTS),
  toxic: z
    .boolean()
    .describe('True when the text contains insults, threats, hate, personal data or spam'),
  reasons: z.array(z.string().max(120)).max(5).describe('Why the review was flagged, if toxic'),
  topics: z.array(z.enum(REVIEW_TOPICS)).max(5).describe('What the review talks about'),
});
export type ReviewModeration = z.infer<typeof ReviewModerationSchema>;

export const ReviewInsightsSchema = z.object({
  headline: z.string().max(140).describe('One-line verdict on customer satisfaction'),
  overallSentiment: z.enum(SENTIMENTS),
  strengths: z.array(z.string().max(160)).max(4),
  issues: z.array(z.string().max(160)).max(4),
  recommendedActions: z.array(z.string().max(200)).max(4),
});
export type ReviewInsights = z.infer<typeof ReviewInsightsSchema>;
