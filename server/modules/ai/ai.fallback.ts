import type { ClaimTriage, ReviewModeration } from '../../../lib/quality/ai-schemas';
import type {
  ClaimCategory,
  ClaimPriority,
  ReviewTopic,
  Sentiment,
} from '../../shared/database/enums';

/**
 * Deterministic fallback used when no API key is configured, the provider times out,
 * or the model returns an invalid object. Same output shape as the LLM (Zod contract),
 * so the rest of the app never needs to know which path produced the result.
 * Keywords cover English, French and transliterated Tunisian Arabic.
 */

const CATEGORY_KEYWORDS: [ClaimCategory, RegExp][] = [
  ['DAMAGE', /(broken|damag|scratch|crack|cass[ée]|abîm|abim|endommag|ray[ée]|mkasr|tkasser)/i],
  ['LOSS', /(lost|missing|stolen|perdu|manqu|disparu|vol[ée]|ma3adech|dhaa?3)/i],
  ['DELAY', /(late|delay|waited|hours? late|retard|attendu|en retard|t2a5er|ta5er)/i],
  ['BEHAVIOUR', /(rude|insult|aggressive|impoli|agressi|irrespect|comportement|kleb)/i],
  ['BILLING', /(price|overcharg|invoice|bill|paid|factur|prix|tarif|pay[ée]|flous)/i],
];

const NEGATIVE =
  /(terrible|awful|worst|never again|horrible|nul|catastroph|inadmissible|scandal|furious|f[aâ]ch[ée])/i;
const POSITIVE =
  /(great|excellent|perfect|thank|recommend|parfait|merci|bravo|top|super|professionnel|ya3tik)/i;
const URGENT = /(urgent|injur|bless|danger|police|immediately|imm[ée]diatement|fire|incendie)/i;
const TOXIC =
  /(idiot|stupid|connard|salaud|imb[ée]cile|fuck|shit|merde|kill you|thief|voleurs?\b|9a7ba|zebi)/i;
const PHONE_OR_EMAIL = /(\+?\d[\d\s]{7,}\d|[\w.+-]+@[\w-]+\.[\w.]+)/;

const TOPIC_KEYWORDS: [ReviewTopic, RegExp][] = [
  ['PUNCTUALITY', /(on time|late|early|ponctu|retard|heure|wa9t)/i],
  ['CARE', /(careful|care|soin|délicat|delicat|fragile|protect)/i],
  ['COMMUNICATION', /(call|communic|answer|répond|repond|message|informed)/i],
  ['PRICE', /(price|cheap|expensive|prix|cher|tarif|value)/i],
  ['PROFESSIONALISM', /(professional|polite|friendly|professionnel|poli|aimable|serieux|sérieux)/i],
  ['DAMAGE', /(broken|damag|scratch|cass|abîm|endommag)/i],
];

function sentimentOf(text: string, rating?: number): Sentiment {
  if (rating !== undefined) {
    if (rating >= 4) return NEGATIVE.test(text) ? 'NEUTRAL' : 'POSITIVE';
    if (rating <= 2) return 'NEGATIVE';
  }
  if (NEGATIVE.test(text)) return 'NEGATIVE';
  if (POSITIVE.test(text)) return 'POSITIVE';
  return 'NEUTRAL';
}

export function triageClaimByRules(input: {
  subject: string;
  description: string;
  amountClaimed: number | null;
  category?: ClaimCategory;
}): ClaimTriage {
  const text = `${input.subject}\n${input.description}`;
  const detected = CATEGORY_KEYWORDS.find(([, pattern]) => pattern.test(text))?.[0];
  const category = detected ?? input.category ?? 'OTHER';

  let priority: ClaimPriority = 'MEDIUM';
  if (URGENT.test(text)) priority = 'URGENT';
  else if ((input.amountClaimed ?? 0) >= 1000 || category === 'LOSS') priority = 'HIGH';
  else if (category === 'DELAY' && (input.amountClaimed ?? 0) === 0) priority = 'LOW';

  const firstSentence = input.description.split(/(?<=[.!?])\s/)[0] ?? input.description;
  return {
    category,
    priority,
    summary: firstSentence.slice(0, 280),
    suggestedAction:
      priority === 'URGENT'
        ? 'Call the client today and secure evidence (photos, crew statement) before any decision.'
        : 'Request photos and the move checklist, then contact the mover for their version.',
    sentiment: sentimentOf(text),
    confidence: detected ? 0.6 : 0.3,
  };
}

export function moderateReviewByRules(input: {
  comment: string;
  rating: number;
}): ReviewModeration {
  const reasons: string[] = [];
  if (TOXIC.test(input.comment)) reasons.push('Insulting or abusive language');
  if (PHONE_OR_EMAIL.test(input.comment)) reasons.push('Contains personal contact details');
  if (/(https?:\/\/|www\.)/i.test(input.comment)) reasons.push('Contains a link (possible spam)');

  return {
    sentiment: sentimentOf(input.comment, input.rating),
    toxic: reasons.length > 0,
    reasons,
    topics: TOPIC_KEYWORDS.filter(([, pattern]) => pattern.test(input.comment))
      .map(([topic]) => topic)
      .slice(0, 5),
  };
}
