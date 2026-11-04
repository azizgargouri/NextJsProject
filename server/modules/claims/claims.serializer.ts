import type { ClaimDoc, ClaimEventKind } from '../../shared/database/models/claim.model';
import type {
  ClaimCategory,
  ClaimOutcome,
  ClaimPriority,
  ClaimStatus,
  Role,
  Sentiment,
  AnalysisSource,
} from '../../shared/database/enums';

export interface UserRef {
  id: string;
  name: string;
  email?: string;
  role?: Role;
}

export interface ClaimEventResponse {
  kind: ClaimEventKind;
  author: UserRef | null;
  authorRole: Role;
  text: string;
  status: ClaimStatus | null;
  createdAt: string;
}

export interface ClaimResponse {
  id: string;
  reference: string;
  status: ClaimStatus;
  category: ClaimCategory;
  subject: string;
  description: string;
  amountClaimed: number | null;
  moveReference: string | null;
  client: UserRef | null;
  mover: UserRef | null;
  resolution: {
    outcome: ClaimOutcome;
    amount: number | null;
    note: string;
    resolvedAt: string;
  } | null;
  timeline: ClaimEventResponse[];
  createdAt: string;
  updatedAt: string;
  /** Staff-only fields — stripped from the client / mover view. */
  priority?: ClaimPriority;
  aiTriage?: {
    source: AnalysisSource;
    category: ClaimCategory;
    priority: ClaimPriority;
    summary: string;
    suggestedAction: string;
    sentiment: Sentiment;
    confidence: number;
    model: string | null;
  } | null;
}

export type ClaimAudience = 'staff' | 'party';

/**
 * Whitelist serializer (instanct "@Expose" equivalent). The audience decides what leaves
 * the server: parties never see internal priority or the AI triage notes.
 */
export function serializeClaim(
  doc: ClaimDoc,
  users: Map<string, UserRef>,
  audience: ClaimAudience,
): ClaimResponse {
  const base: ClaimResponse = {
    id: String(doc._id),
    reference: doc.reference,
    status: doc.status,
    category: doc.category,
    subject: doc.subject,
    description: doc.description,
    amountClaimed: doc.amountClaimed ?? null,
    moveReference: doc.moveReference ?? null,
    client: users.get(doc.clientId) ?? null,
    mover: doc.moverId ? (users.get(doc.moverId) ?? null) : null,
    resolution: doc.resolution
      ? {
          outcome: doc.resolution.outcome,
          amount: doc.resolution.amount ?? null,
          note: doc.resolution.note,
          resolvedAt: doc.resolution.resolvedAt.toISOString(),
        }
      : null,
    timeline: (doc.timeline ?? []).map((event) => ({
      kind: event.kind,
      author: users.get(event.authorId) ?? null,
      authorRole: event.authorRole,
      text: event.text,
      status: event.status ?? null,
      createdAt: new Date(event.createdAt).toISOString(),
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };

  if (audience === 'party') {
    // Staff identities stay private: parties only see "MoveUp support".
    base.timeline = base.timeline.map((event) =>
      event.authorRole === 'ADMIN'
        ? { ...event, author: { id: 'staff', name: 'MoveUp support' } }
        : event,
    );
    if (base.client) base.client = { id: base.client.id, name: base.client.name };
    return base;
  }

  return {
    ...base,
    priority: doc.priority,
    aiTriage: doc.aiTriage
      ? {
          source: doc.aiTriage.source,
          category: doc.aiTriage.category,
          priority: doc.aiTriage.priority,
          summary: doc.aiTriage.summary,
          suggestedAction: doc.aiTriage.suggestedAction,
          sentiment: doc.aiTriage.sentiment,
          confidence: doc.aiTriage.confidence,
          model: doc.aiTriage.model ?? null,
        }
      : null,
  };
}

/** Collects every user id a set of claims refers to (one lookup query, no N+1). */
export function claimUserIds(docs: ClaimDoc[]): string[] {
  const ids = new Set<string>();
  for (const doc of docs) {
    ids.add(doc.clientId);
    if (doc.moverId) ids.add(doc.moverId);
    for (const event of doc.timeline ?? []) ids.add(event.authorId);
  }
  return [...ids];
}
