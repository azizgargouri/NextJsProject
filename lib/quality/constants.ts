/**
 * Quality-domain vocabulary shared by the server (Mongoose enums, Zod schemas)
 * and the client (labels, filters, AI SDK `useObject` schemas).
 * Framework-agnostic on purpose: no React, no Mongoose — only constants.
 */

export const CLAIM_CATEGORIES = [
  'DAMAGE',
  'LOSS',
  'DELAY',
  'BEHAVIOUR',
  'BILLING',
  'OTHER',
] as const;
export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number];

export const CLAIM_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type ClaimPriority = (typeof CLAIM_PRIORITIES)[number];

export const CLAIM_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_OUTCOMES = ['FULL_REFUND', 'PARTIAL_REFUND', 'REPAIR', 'NO_ACTION'] as const;
export type ClaimOutcome = (typeof CLAIM_OUTCOMES)[number];

/** Allowed status moves. RESOLVED / REJECTED can only be reopened into review by staff. */
export const CLAIM_TRANSITIONS: Record<ClaimStatus, readonly ClaimStatus[]> = {
  OPEN: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['RESOLVED', 'REJECTED', 'OPEN'],
  RESOLVED: ['UNDER_REVIEW'],
  REJECTED: ['UNDER_REVIEW'],
};

/** Pure rule shared by the service (enforcement) and the admin UI (which buttons to show). */
export function canTransitionClaim(from: ClaimStatus, to: ClaimStatus): boolean {
  return from === to || CLAIM_TRANSITIONS[from].includes(to);
}

export const REVIEW_STATUSES = ['PUBLISHED', 'FLAGGED', 'HIDDEN'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const SENTIMENTS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const REVIEW_TOPICS = [
  'PUNCTUALITY',
  'CARE',
  'COMMUNICATION',
  'PRICE',
  'PROFESSIONALISM',
  'DAMAGE',
] as const;
export type ReviewTopic = (typeof REVIEW_TOPICS)[number];

/** Where an automated decision came from: a real LLM call or the deterministic fallback. */
export const ANALYSIS_SOURCES = ['ai', 'rules'] as const;
export type AnalysisSource = (typeof ANALYSIS_SOURCES)[number];

export const CLAIM_CATEGORY_LABELS: Record<ClaimCategory, string> = {
  DAMAGE: 'Damaged items',
  LOSS: 'Lost items',
  DELAY: 'Delay',
  BEHAVIOUR: 'Crew behaviour',
  BILLING: 'Billing',
  OTHER: 'Other',
};

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  OPEN: 'Open',
  UNDER_REVIEW: 'Under review',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
};

export const CLAIM_PRIORITY_LABELS: Record<ClaimPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const CLAIM_OUTCOME_LABELS: Record<ClaimOutcome, string> = {
  FULL_REFUND: 'Full refund',
  PARTIAL_REFUND: 'Partial refund',
  REPAIR: 'Repair / replacement',
  NO_ACTION: 'No action',
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  PUBLISHED: 'Published',
  FLAGGED: 'Flagged',
  HIDDEN: 'Hidden',
};

export const REVIEW_TOPIC_LABELS: Record<ReviewTopic, string> = {
  PUNCTUALITY: 'Punctuality',
  CARE: 'Care of items',
  COMMUNICATION: 'Communication',
  PRICE: 'Price',
  PROFESSIONALISM: 'Professionalism',
  DAMAGE: 'Damage',
};
