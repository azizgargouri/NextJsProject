import { z } from 'zod';
import {
  CLAIM_CATEGORIES,
  CLAIM_OUTCOMES,
  CLAIM_PRIORITIES,
  DAMAGE_SEVERITIES,
  REVIEW_TOPICS,
  SENTIMENTS,
} from './constants';

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

/**
 * Multimodal Vision AI damage assessment (course ch.6 — "Synthèse & Vision" + generateObject).
 * Evaluates uploaded evidence photos to detect damaged items, severity, repair/replacement
 * cost in TND, and auto-fill suggestions for the client claim form.
 */
export const DamageVisionItemSchema = z.object({
  name: z.string().max(80).describe('Detected furniture or household item name'),
  material: z.string().max(60).describe('Primary material (e.g. tempered glass, oak wood, fabric)'),
  damageType: z.string().max(120).describe('Type of damage observed (e.g. deep crack, broken leg)'),
  severity: z.enum(DAMAGE_SEVERITIES),
  damageRatePct: z
    .number()
    .min(0)
    .max(100)
    .default(50)
    .describe('Estimated item damage rate percentage (0-100%) based on visual & ROI inspection'),
  roiCoveragePct: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Percentage of photo covered by the user-drawn red damage rectangle(s)'),
  repairable: z.boolean(),
  estimatedCostTnd: z
    .number()
    .min(0)
    .max(50_000)
    .describe('Estimated repair or replacement in TND'),
});
export type DamageVisionItem = z.infer<typeof DamageVisionItemSchema>;

export const DamageVisionSchema = z.object({
  detectedItems: z.array(DamageVisionItemSchema).max(8),
  overallSeverity: z.enum(DAMAGE_SEVERITIES),
  overallDamageRatePct: z
    .number()
    .min(0)
    .max(100)
    .default(50)
    .describe('Overall weighted damage rate percentage across all inspected items (0-100%)'),
  suggestedCategory: z.enum(CLAIM_CATEGORIES),
  estimatedRepairMinTnd: z.number().min(0).max(100_000),
  estimatedRepairMaxTnd: z.number().min(0).max(100_000),
  recommendedClaimAmountTnd: z.number().min(0).max(100_000),
  suggestedSubject: z.string().max(120).describe('Concise claim subject ready to fill the form'),
  suggestedDescription: z
    .string()
    .max(1500)
    .describe('Detailed factual description of the visual damage for the claim statement'),
  authenticityNotes: z
    .string()
    .max(240)
    .describe('Visual consistency check (fresh fracture edges, packaging state, lighting)'),
  confidence: z.number().min(0).max(1),
});
export type DamageVision = z.infer<typeof DamageVisionSchema>;

/**
 * AI Dispute Mediator & Compensation Calculator (course ch.6 — streamObject + useObject).
 * Streams a structured arbitration proposal cross-referencing client claim, vision evidence,
 * mover track record, and MoveUp platform policy rules.
 */
export const CompensationBreakdownItemSchema = z.object({
  item: z.string().max(120).describe('Line item (e.g. Base item value, Depreciation, Policy cap)'),
  amountTnd: z.number().min(-100_000).max(100_000),
  rationale: z.string().max(180),
});
export type CompensationBreakdownItem = z.infer<typeof CompensationBreakdownItemSchema>;

export const ClaimMediationSchema = z.object({
  recommendedOutcome: z.enum(CLAIM_OUTCOMES),
  recommendedAmountTnd: z.number().min(0).max(100_000),
  clientLiabilityPct: z.number().min(0).max(100),
  moverLiabilityPct: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(1),
  riskLevel: z.enum(CLAIM_PRIORITIES),
  executiveSummary: z
    .string()
    .max(320)
    .describe('Arbitration summary for the back-office operator'),
  policyCitations: z
    .array(z.string().max(200))
    .max(4)
    .describe('Applicable MoveUp Specification & Tunisian transport liability rules'),
  evidenceFactors: z
    .array(z.string().max(200))
    .max(5)
    .describe('Key facts from the statement, timeline, mover rating, and photo evidence'),
  compensationBreakdown: z.array(CompensationBreakdownItemSchema).max(5),
  draftResolutionNote: z
    .string()
    .max(1200)
    .describe('Ready-to-send formal resolution note for both client and mover'),
});
export type ClaimMediation = z.infer<typeof ClaimMediationSchema>;

/**
 * Public AI Mover Trust & Reliability Scorecard (course ch.6 — streamObject + useObject).
 * Synthesizes verified customer ratings, sub-ratings, and dispute resolution history.
 */
export const MoverScorecardSchema = z.object({
  trustScore: z.number().min(0).max(100).describe('Overall AI trust & reliability score (0-100)'),
  tierBadge: z
    .enum(['ELITE_VERIFIED', 'TRUSTED_PRO', 'STANDARD_PARTNER', 'UNDER_WATCH'])
    .describe('Trust tier badge based on reviews and claims'),
  punctualityScore: z.number().min(0).max(100),
  itemCareScore: z.number().min(0).max(100),
  communicationScore: z.number().min(0).max(100),
  claimResolutionScore: z.number().min(0).max(100),
  verdict: z.string().max(280).describe('2-sentence AI synthesis of verified reviews and claims'),
  strengths: z.array(z.string().max(160)).max(3),
  watchouts: z.array(z.string().max(160)).max(3),
});
export type MoverScorecard = z.infer<typeof MoverScorecardSchema>;
