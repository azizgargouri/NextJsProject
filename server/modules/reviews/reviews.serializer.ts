import type { ReviewDoc } from '../../shared/database/models/review.model';
import type {
  ReviewStatus,
  ReviewTopic,
  Sentiment,
  AnalysisSource,
} from '../../shared/database/enums';

export interface ReviewUserRef {
  id: string;
  name: string;
}

export interface ReviewResponse {
  id: string;
  moveReference: string;
  rating: number;
  punctuality: number | null;
  care: number | null;
  communication: number | null;
  comment: string;
  status: ReviewStatus;
  client: ReviewUserRef | null;
  mover: ReviewUserRef | null;
  moverReply: { text: string; createdAt: string } | null;
  createdAt: string;
  moderation?: {
    source: AnalysisSource;
    sentiment: Sentiment;
    toxic: boolean;
    reasons: string[];
    topics: ReviewTopic[];
    model: string | null;
  } | null;
  moderationNote?: string | null;
}

export type ReviewAudience = 'public' | 'author' | 'staff';

/** "Amira Ben Salah" → "Amira B." — public pages never show a client's full name. */
export function publicName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const initial = rest.find(Boolean)?.[0];
  return initial ? `${first} ${initial.toUpperCase()}.` : (first ?? 'Client');
}

export function serializeReview(
  doc: ReviewDoc,
  users: Map<string, { id: string; name: string }>,
  audience: ReviewAudience,
): ReviewResponse {
  const client = users.get(doc.clientId);
  const mover = users.get(doc.moverId);
  const base: ReviewResponse = {
    id: String(doc._id),
    moveReference: doc.moveReference,
    rating: doc.rating,
    punctuality: doc.punctuality ?? null,
    care: doc.care ?? null,
    communication: doc.communication ?? null,
    comment: doc.comment,
    status: doc.status,
    client: client
      ? { id: client.id, name: audience === 'public' ? publicName(client.name) : client.name }
      : null,
    mover: mover ? { id: mover.id, name: mover.name } : null,
    moverReply: doc.moverReply
      ? {
          text: doc.moverReply.text,
          createdAt: new Date(
            doc.moverReply.createdAt ?? doc.createdAt ?? Date.now(),
          ).toISOString(),
        }
      : null,
    createdAt: new Date(doc.createdAt ?? Date.now()).toISOString(),
  };

  if (audience === 'author') return { ...base, moderationNote: doc.moderationNote ?? null };
  if (audience !== 'staff') return base;

  return {
    ...base,
    moderationNote: doc.moderationNote ?? null,
    moderation: doc.moderation
      ? {
          source: doc.moderation.source,
          sentiment: doc.moderation.sentiment,
          toxic: doc.moderation.toxic,
          reasons: doc.moderation.reasons ?? [],
          topics: doc.moderation.topics ?? [],
          model: doc.moderation.model ?? null,
        }
      : null,
  };
}
