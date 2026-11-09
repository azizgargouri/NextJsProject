import type {
  ClaimDoc,
  ClaimEventKind,
  ClaimMediationDoc,
  ClaimVisionAnalysisDoc,
} from '../../shared/database/models/claim.model';
import type {
  ClaimCategory,
  ClaimOutcome,
  ClaimPriority,
  ClaimStatus,
  DamageSeverity,
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

export interface ClaimVisionAnalysisResponse {
  source: AnalysisSource;
  model: string | null;
  detectedItems: {
    name: string;
    material: string;
    damageType: string;
    severity: DamageSeverity;
    damageRatePct: number;
    roiCoveragePct?: number;
    repairable: boolean;
    estimatedCostTnd: number;
  }[];
  overallSeverity: DamageSeverity;
  overallDamageRatePct: number;
  suggestedCategory: ClaimCategory;
  estimatedRepairMinTnd: number;
  estimatedRepairMaxTnd: number;
  recommendedClaimAmountTnd: number;
  suggestedSubject: string;
  suggestedDescription: string;
  authenticityNotes?: string;
  confidence: number;
  analyzedAt: string;
}

export interface ClaimMediationResponse {
  source: AnalysisSource;
  model: string | null;
  recommendedOutcome: ClaimOutcome;
  recommendedAmountTnd: number;
  clientLiabilityPct: number;
  moverLiabilityPct: number;
  confidenceScore: number;
  riskLevel: ClaimPriority;
  executiveSummary: string;
  policyCitations: string[];
  evidenceFactors: string[];
  compensationBreakdown: {
    item: string;
    amountTnd: number;
    rationale: string;
  }[];
  draftResolutionNote: string;
  generatedAt: string;
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
  evidencePhotos: string[];
  visionAnalysis: ClaimVisionAnalysisResponse | null;
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
  aiMediation?: ClaimMediationResponse | null;
}

export type ClaimAudience = 'staff' | 'party';

function serializeVision(
  vision: ClaimVisionAnalysisDoc | null | undefined,
  audience: ClaimAudience,
): ClaimVisionAnalysisResponse | null {
  if (!vision) return null;
  return {
    source: vision.source,
    model: vision.model ?? null,
    detectedItems: (vision.detectedItems ?? []).map((item) => ({
      name: item.name,
      material: item.material,
      damageType: item.damageType,
      severity: item.severity,
      damageRatePct: item.damageRatePct ?? (item.repairable ? 45 : 95),
      ...(item.roiCoveragePct !== undefined ? { roiCoveragePct: item.roiCoveragePct } : {}),
      repairable: item.repairable,
      estimatedCostTnd: item.estimatedCostTnd,
    })),
    overallSeverity: vision.overallSeverity,
    overallDamageRatePct: vision.overallDamageRatePct ?? 65,
    suggestedCategory: vision.suggestedCategory,
    estimatedRepairMinTnd: vision.estimatedRepairMinTnd,
    estimatedRepairMaxTnd: vision.estimatedRepairMaxTnd,
    recommendedClaimAmountTnd: vision.recommendedClaimAmountTnd,
    suggestedSubject: vision.suggestedSubject,
    suggestedDescription: vision.suggestedDescription,
    ...(audience === 'staff' ? { authenticityNotes: vision.authenticityNotes } : {}),
    confidence: vision.confidence,
    analyzedAt: new Date(vision.analyzedAt ?? Date.now()).toISOString(),
  };
}

function serializeMediation(
  mediation: ClaimMediationDoc | null | undefined,
): ClaimMediationResponse | null {
  if (!mediation) return null;
  return {
    source: mediation.source,
    model: mediation.model ?? null,
    recommendedOutcome: mediation.recommendedOutcome,
    recommendedAmountTnd: mediation.recommendedAmountTnd,
    clientLiabilityPct: mediation.clientLiabilityPct,
    moverLiabilityPct: mediation.moverLiabilityPct,
    confidenceScore: mediation.confidenceScore,
    riskLevel: mediation.riskLevel,
    executiveSummary: mediation.executiveSummary,
    policyCitations: mediation.policyCitations ?? [],
    evidenceFactors: mediation.evidenceFactors ?? [],
    compensationBreakdown: (mediation.compensationBreakdown ?? []).map((row) => ({
      item: row.item,
      amountTnd: row.amountTnd,
      rationale: row.rationale,
    })),
    draftResolutionNote: mediation.draftResolutionNote,
    generatedAt: new Date(mediation.generatedAt ?? Date.now()).toISOString(),
  };
}

/**
 * Whitelist serializer (instanct "@Expose" equivalent). The audience decides what leaves
 * the server: parties never see internal priority, AI triage notes, or staff mediation.
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
    evidencePhotos: doc.evidencePhotos ?? [],
    visionAnalysis: serializeVision(doc.visionAnalysis, audience),
    client: users.get(doc.clientId) ?? null,
    mover: doc.moverId ? (users.get(doc.moverId) ?? null) : null,
    resolution: doc.resolution
      ? {
          outcome: doc.resolution.outcome,
          amount: doc.resolution.amount ?? null,
          note: doc.resolution.note,
          resolvedAt: new Date(
            doc.resolution.resolvedAt ?? doc.updatedAt ?? doc.createdAt ?? Date.now(),
          ).toISOString(),
        }
      : null,
    timeline: (doc.timeline ?? []).map((event) => ({
      kind: event.kind,
      author: users.get(event.authorId) ?? null,
      authorRole: event.authorRole,
      text: event.text,
      status: event.status ?? null,
      createdAt: new Date(event.createdAt ?? doc.createdAt ?? Date.now()).toISOString(),
    })),
    createdAt: new Date(doc.createdAt ?? Date.now()).toISOString(),
    updatedAt: new Date(doc.updatedAt ?? doc.createdAt ?? Date.now()).toISOString(),
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
    aiMediation: serializeMediation(doc.aiMediation),
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
