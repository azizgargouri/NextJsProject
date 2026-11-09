import { Schema, model, models, type Model, type Types } from 'mongoose';
import {
  ANALYSIS_SOURCES,
  CLAIM_CATEGORIES,
  CLAIM_OUTCOMES,
  CLAIM_PRIORITIES,
  CLAIM_STATUSES,
  DAMAGE_SEVERITIES,
  ROLES,
  SENTIMENTS,
  type AnalysisSource,
  type ClaimCategory,
  type ClaimOutcome,
  type ClaimPriority,
  type ClaimStatus,
  type DamageSeverity,
  type Role,
  type Sentiment,
} from '../enums';

/**
 * Claim document — a client dispute about a move (spec A-08 "Disputes").
 * One record holds the whole story: the client's statement, the AI triage,
 * the vision evidence analysis, the conversation between client / mover / staff,
 * the AI mediation & compensation proposal, and the final resolution.
 */
export const CLAIM_EVENT_KINDS = ['CREATED', 'MESSAGE', 'STATUS_CHANGED', 'RESOLUTION'] as const;
export type ClaimEventKind = (typeof CLAIM_EVENT_KINDS)[number];

export interface ClaimEvent {
  kind: ClaimEventKind;
  authorId: string;
  authorRole: Role;
  text: string;
  status: ClaimStatus | null;
  createdAt: Date;
}

export interface ClaimTriageDoc {
  source: AnalysisSource;
  category: ClaimCategory;
  priority: ClaimPriority;
  summary: string;
  suggestedAction: string;
  sentiment: Sentiment;
  confidence: number;
  model: string | null;
  createdAt: Date;
}

export interface ClaimVisionItemDoc {
  name: string;
  material: string;
  damageType: string;
  severity: DamageSeverity;
  damageRatePct?: number;
  roiCoveragePct?: number;
  repairable: boolean;
  estimatedCostTnd: number;
}

export interface ClaimVisionAnalysisDoc {
  source: AnalysisSource;
  model: string | null;
  detectedItems: ClaimVisionItemDoc[];
  overallSeverity: DamageSeverity;
  overallDamageRatePct?: number;
  suggestedCategory: ClaimCategory;
  estimatedRepairMinTnd: number;
  estimatedRepairMaxTnd: number;
  recommendedClaimAmountTnd: number;
  suggestedSubject: string;
  suggestedDescription: string;
  authenticityNotes: string;
  confidence: number;
  analyzedAt: Date;
}

export interface ClaimMediationBreakdownDoc {
  item: string;
  amountTnd: number;
  rationale: string;
}

export interface ClaimMediationDoc {
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
  compensationBreakdown: ClaimMediationBreakdownDoc[];
  draftResolutionNote: string;
  generatedAt: Date;
}

export interface ClaimResolution {
  outcome: ClaimOutcome;
  amount: number | null;
  note: string;
  resolvedBy: string;
  resolvedAt: Date;
}

export interface ClaimDoc {
  reference: string;
  clientId: string;
  moverId: string | null;
  moveReference: string | null;
  category: ClaimCategory;
  priority: ClaimPriority;
  status: ClaimStatus;
  subject: string;
  description: string;
  amountClaimed: number | null;
  evidencePhotos: string[];
  visionAnalysis: ClaimVisionAnalysisDoc | null;
  aiTriage: ClaimTriageDoc | null;
  aiMediation: ClaimMediationDoc | null;
  resolution: ClaimResolution | null;
  timeline: ClaimEvent[];
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

const ClaimEventSchema = new Schema<ClaimEvent>(
  {
    kind: { type: String, enum: [...CLAIM_EVENT_KINDS], required: true },
    authorId: { type: String, required: true },
    authorRole: { type: String, enum: [...ROLES], required: true },
    text: { type: String, default: '' },
    status: { type: String, enum: [...CLAIM_STATUSES, null], default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const ClaimTriageSchema = new Schema<ClaimTriageDoc>(
  {
    source: { type: String, enum: [...ANALYSIS_SOURCES], required: true },
    category: { type: String, enum: [...CLAIM_CATEGORIES], required: true },
    priority: { type: String, enum: [...CLAIM_PRIORITIES], required: true },
    summary: { type: String, default: '' },
    suggestedAction: { type: String, default: '' },
    sentiment: { type: String, enum: [...SENTIMENTS], required: true },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    model: { type: String, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const ClaimVisionItemSchema = new Schema<ClaimVisionItemDoc>(
  {
    name: { type: String, required: true },
    material: { type: String, default: '' },
    damageType: { type: String, default: '' },
    severity: { type: String, enum: [...DAMAGE_SEVERITIES], required: true },
    damageRatePct: { type: Number, min: 0, max: 100, default: 50 },
    roiCoveragePct: { type: Number, min: 0, max: 100 },
    repairable: { type: Boolean, default: true },
    estimatedCostTnd: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const ClaimVisionAnalysisSchema = new Schema<ClaimVisionAnalysisDoc>(
  {
    source: { type: String, enum: [...ANALYSIS_SOURCES], required: true },
    model: { type: String, default: null },
    detectedItems: { type: [ClaimVisionItemSchema], default: [] },
    overallSeverity: { type: String, enum: [...DAMAGE_SEVERITIES], required: true },
    overallDamageRatePct: { type: Number, min: 0, max: 100, default: 50 },
    suggestedCategory: { type: String, enum: [...CLAIM_CATEGORIES], required: true },
    estimatedRepairMinTnd: { type: Number, min: 0, default: 0 },
    estimatedRepairMaxTnd: { type: Number, min: 0, default: 0 },
    recommendedClaimAmountTnd: { type: Number, min: 0, default: 0 },
    suggestedSubject: { type: String, default: '' },
    suggestedDescription: { type: String, default: '' },
    authenticityNotes: { type: String, default: '' },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    analyzedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const ClaimMediationBreakdownSchema = new Schema<ClaimMediationBreakdownDoc>(
  {
    item: { type: String, required: true },
    amountTnd: { type: Number, required: true },
    rationale: { type: String, default: '' },
  },
  { _id: false },
);

const ClaimMediationSchema = new Schema<ClaimMediationDoc>(
  {
    source: { type: String, enum: [...ANALYSIS_SOURCES], required: true },
    model: { type: String, default: null },
    recommendedOutcome: { type: String, enum: [...CLAIM_OUTCOMES], required: true },
    recommendedAmountTnd: { type: Number, min: 0, default: 0 },
    clientLiabilityPct: { type: Number, min: 0, max: 100, default: 0 },
    moverLiabilityPct: { type: Number, min: 0, max: 100, default: 100 },
    confidenceScore: { type: Number, min: 0, max: 1, default: 0 },
    riskLevel: { type: String, enum: [...CLAIM_PRIORITIES], default: 'MEDIUM' },
    executiveSummary: { type: String, default: '' },
    policyCitations: { type: [String], default: [] },
    evidenceFactors: { type: [String], default: [] },
    compensationBreakdown: { type: [ClaimMediationBreakdownSchema], default: [] },
    draftResolutionNote: { type: String, default: '' },
    generatedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const ClaimResolutionSchema = new Schema<ClaimResolution>(
  {
    outcome: { type: String, enum: [...CLAIM_OUTCOMES], required: true },
    amount: { type: Number, default: null, min: 0 },
    note: { type: String, required: true },
    resolvedBy: { type: String, required: true },
    resolvedAt: { type: Date, required: true },
  },
  { _id: false },
);

const ClaimSchema = new Schema<ClaimDoc>(
  {
    reference: { type: String, required: true, unique: true, index: true },
    clientId: { type: String, required: true, index: true },
    moverId: { type: String, default: null, index: true },
    moveReference: { type: String, default: null, trim: true, uppercase: true },
    category: { type: String, enum: [...CLAIM_CATEGORIES], required: true },
    priority: { type: String, enum: [...CLAIM_PRIORITIES], default: 'MEDIUM' },
    status: { type: String, enum: [...CLAIM_STATUSES], default: 'OPEN', index: true },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    amountClaimed: { type: Number, default: null, min: 0 },
    evidencePhotos: { type: [String], default: [] },
    visionAnalysis: { type: ClaimVisionAnalysisSchema, default: null },
    aiTriage: { type: ClaimTriageSchema, default: null },
    aiMediation: { type: ClaimMediationSchema, default: null },
    resolution: { type: ClaimResolutionSchema, default: null },
    timeline: { type: [ClaimEventSchema], default: [] },
  },
  { timestamps: true },
);

ClaimSchema.index({ status: 1, priority: 1, createdAt: -1 });
ClaimSchema.index({ subject: 'text', description: 'text', reference: 'text' });

export const ClaimModel = (models.Claim ?? model('Claim', ClaimSchema)) as Model<ClaimDoc>;
