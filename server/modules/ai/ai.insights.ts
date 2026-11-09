import type { ReviewInsights } from '../../../lib/quality/ai-schemas';
import { REVIEW_TOPIC_LABELS, type ReviewTopic } from '../../shared/database/enums';
import { moderateReviewByRules } from './ai.fallback';
import type { ClaimResponse } from '../claims/claims.serializer';

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
