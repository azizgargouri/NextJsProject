import type { MoverScorecard, ReviewInsights } from '../../../lib/quality/ai-schemas';
import { REVIEW_TOPIC_LABELS, type ReviewTopic } from '../../shared/database/enums';
import { moderateReviewByRules } from './ai.fallback';
import type { ClaimResponse } from '../claims/claims.serializer';
import type { RatingSummary } from '../reviews/reviews.repository';

/** Prompt material for the streamed review insights (no names, ids or emails ever sent). */
export function insightsPrompt(corpus: { rating: number; comment: string }[]): string {
  return [
    `Here are ${corpus.length} recent published customer reviews of moving companies on MoveUp.`,
    'Identify recurring strengths, recurring issues and concrete actions for the operations team.',
    'Answer in English. Each bullet must be specific and short.',
    '',
    ...corpus.map((review, index) => `${index + 1}. [${review.rating}/5] ${review.comment}`),
  ].join('\n');
}

/** Deterministic insights when no model is configured — counts topics per sentiment. */
export function insightsByRules(corpus: { rating: number; comment: string }[]): ReviewInsights {
  const praise = new Map<ReviewTopic, number>();
  const complaints = new Map<ReviewTopic, number>();
  let total = 0;
  for (const review of corpus) {
    total += review.rating;
    const analysis = moderateReviewByRules(review);
    const bucket = review.rating >= 4 ? praise : review.rating <= 2 ? complaints : null;
    for (const topic of analysis.topics) bucket?.set(topic, (bucket.get(topic) ?? 0) + 1);
  }
  const average = corpus.length ? total / corpus.length : 0;
  const top = (map: Map<ReviewTopic, number>) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return {
    headline: corpus.length
      ? `Average ${average.toFixed(1)}/5 over ${corpus.length} published reviews (rule-based summary).`
      : 'No published reviews yet.',
    overallSentiment: average >= 4 ? 'POSITIVE' : average <= 2.5 ? 'NEGATIVE' : 'NEUTRAL',
    strengths: top(praise).map(
      ([topic, count]) => `${REVIEW_TOPIC_LABELS[topic]} praised in ${count} review(s)`,
    ),
    issues: top(complaints).map(
      ([topic, count]) => `${REVIEW_TOPIC_LABELS[topic]} criticised in ${count} review(s)`,
    ),
    recommendedActions: top(complaints).map(
      ([topic]) =>
        `Brief movers on ${REVIEW_TOPIC_LABELS[topic].toLowerCase()} and follow up with unhappy clients.`,
    ),
  };
}

/** Full claim context for the resolution draft (staff view; already authorised). */
export function claimDraftPrompt(claim: ClaimResponse, instruction?: string): string {
  return [
    `Claim ${claim.reference} — category ${claim.category}, status ${claim.status}.`,
    `Client: ${claim.client?.name ?? 'unknown'}. Mover: ${claim.mover?.name ?? 'not specified'}.`,
    `Move reference: ${claim.moveReference ?? 'not provided'}. Amount claimed: ${claim.amountClaimed ?? 'none'} TND.`,
    `Subject: ${claim.subject}`,
    `Description: ${claim.description}`,
    claim.aiTriage ? `Triage summary: ${claim.aiTriage.summary}` : '',
    'Conversation so far:',
    ...claim.timeline.map((event) => `- [${event.authorRole}] ${event.text || event.kind}`),
    '',
    'Write the reply that MoveUp support will send to the client (and copy to the mover).',
    'Be empathetic, factual, 120 words max, no amounts unless the staff instruction gives one.',
    instruction ? `Staff instruction: ${instruction}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function claimDraftByTemplate(claim: ClaimResponse): string {
  const name = claim.client?.name.split(' ')[0] ?? 'there';
  return (
    `Hello ${name},\n\nThank you for reporting this issue (${claim.reference}). ` +
    `We have reviewed your claim about "${claim.subject}" together with the mover's account. ` +
    `[Describe the decision here.]\n\nWe remain available if you have any question.\n\nMoveUp support`
  );
}

/** Prompt material for the AI Dispute Mediator & Compensation Calculator (streamObject). */
export function claimMediationPrompt(
  claim: ClaimResponse,
  moverStats: { ratingAvg: number | null; claimsCount: number },
): string {
  return [
    `Arbitrate MoveUp dispute ${claim.reference} (${claim.category}, priority ${claim.priority ?? 'MEDIUM'}).`,
    `Client: ${claim.client?.name ?? 'Client'}. Mover: ${claim.mover?.name ?? 'Unspecified'}.`,
    `Move reference: ${claim.moveReference ?? 'none'}. Amount claimed by client: ${claim.amountClaimed ?? 'none'} TND.`,
    `Mover historical rating: ${moverStats.ratingAvg !== null ? `${moverStats.ratingAvg.toFixed(1)}/5` : 'unrated'} (${moverStats.claimsCount} total claims on record).`,
    `Subject: ${claim.subject}`,
    `Client statement: ${claim.description}`,
    claim.visionAnalysis
      ? `Vision AI Evidence Analysis: overall severity ${claim.visionAnalysis.overallSeverity}, ` +
        `estimated repair/replacement ${claim.visionAnalysis.estimatedRepairMinTnd}–${claim.visionAnalysis.estimatedRepairMaxTnd} TND ` +
        `(recommended ${claim.visionAnalysis.recommendedClaimAmountTnd} TND). ` +
        `Items: ${claim.visionAnalysis.detectedItems.map((i) => `${i.name} (${i.damageType}, ${i.estimatedCostTnd} TND)`).join('; ')}.`
      : 'No Vision AI photo analysis attached.',
    claim.aiTriage ? `Initial AI triage summary: ${claim.aiTriage.summary}` : '',
    'Conversation timeline:',
    ...claim.timeline.map((event) => `- [${event.authorRole}] ${event.text || event.kind}`),
    '',
    'Produce a fair, policy-backed mediation and compensation calculation in Tunisian Dinars (TND).',
    'Ensure clientLiabilityPct + moverLiabilityPct = 100.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Prompt material for the public AI Mover Trust & Reliability Scorecard (streamObject + useObject). */
export function moverScorecardPrompt(input: {
  moverName: string;
  summary: RatingSummary;
  claimsCount: number;
  comments: { rating: number; comment: string }[];
}): string {
  return [
    `Generate a customer-facing AI Trust & Reliability Scorecard for moving company "${input.moverName}" on MoveUp (Tunisia).`,
    `Published reviews count: ${input.summary.count}, overall average: ${input.summary.average ?? 'N/A'}/5.`,
    `Sub-ratings: Punctuality ${input.summary.punctuality ?? 'N/A'}/5, Care of items ${input.summary.care ?? 'N/A'}/5, Communication ${input.summary.communication ?? 'N/A'}/5.`,
    `Total claims on record: ${input.claimsCount}.`,
    'Recent verified review comments:',
    ...input.comments.map((c, idx) => `${idx + 1}. [${c.rating}/5] ${c.comment}`),
    '',
    'Synthesize an objective 0-100 trustScore, tierBadge, sub-scores (0-100), a concise 2-sentence verdict, up to 3 strengths, and up to 3 watchouts.',
  ].join('\n');
}

/** Deterministic Mover Scorecard when no cloud LLM is active. */
export function moverScorecardByRules(input: {
  moverName: string;
  summary: RatingSummary;
  claimsCount: number;
  comments: { rating: number; comment: string }[];
}): MoverScorecard {
  const avg = input.summary.average ?? 3.8;
  const punctualityScore = Math.round(((input.summary.punctuality ?? avg) / 5) * 100);
  const itemCareScore = Math.round(((input.summary.care ?? avg) / 5) * 100);
  const communicationScore = Math.round(((input.summary.communication ?? avg) / 5) * 100);
  const claimPenalty = Math.min(35, input.claimsCount * 10);
  const claimResolutionScore = Math.max(55, 95 - claimPenalty);
  const trustScore = Math.min(
    99,
    Math.max(
      40,
      Math.round(
        punctualityScore * 0.25 +
          itemCareScore * 0.35 +
          communicationScore * 0.2 +
          claimResolutionScore * 0.2,
      ),
    ),
  );

  const tierBadge: MoverScorecard['tierBadge'] =
    trustScore >= 88
      ? 'ELITE_VERIFIED'
      : trustScore >= 74
        ? 'TRUSTED_PRO'
        : trustScore >= 58
          ? 'STANDARD_PARTNER'
          : 'UNDER_WATCH';

  const strengths: string[] = [];
  const watchouts: string[] = [];

  if (itemCareScore >= 75)
    strengths.push(`Strong item handling & furniture protection (${itemCareScore}/100 care score)`);
  if (communicationScore >= 75)
    strengths.push(
      `Responsive client communication & coordination (${communicationScore}/100 score)`,
    );
  if (punctualityScore >= 75)
    strengths.push(`Reliable arrival windows & schedule adherence (${punctualityScore}/100 score)`);
  if (strengths.length === 0)
    strengths.push(
      `Verified MoveUp partner with ${input.summary.count} published customer review(s)`,
    );
  strengths.push('Cooperates with MoveUp Dispute Resolution & Vision AI inspection');

  if (punctualityScore < 75)
    watchouts.push(
      `Schedule delays noted in past peak-hour moves (${punctualityScore}/100 punctuality)`,
    );
  if (itemCareScore < 75)
    watchouts.push(
      `Extra fragile-item padding recommended during loading (${itemCareScore}/100 care)`,
    );
  if (input.claimsCount > 0)
    watchouts.push(
      `${input.claimsCount} historical claim(s) logged — request signed inventory sheet at pickup`,
    );
  if (watchouts.length === 0)
    watchouts.push('Book 48h in advance for multi-room inter-governorate relocations');

  return {
    trustScore,
    tierBadge,
    punctualityScore,
    itemCareScore,
    communicationScore,
    claimResolutionScore,
    verdict: `${input.moverName} holds a ${trustScore}/100 MoveUp Trust Index across ${input.summary.count} verified review(s) and ${input.claimsCount} recorded claim(s). Recommended with standard inventory check at loading and delivery.`,
    strengths: strengths.slice(0, 3),
    watchouts: watchouts.slice(0, 3),
  };
}
