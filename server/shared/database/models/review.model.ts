import { Schema, model, models, type Model, type Types } from 'mongoose';
import {
  ANALYSIS_SOURCES,
  REVIEW_STATUSES,
  REVIEW_TOPICS,
  SENTIMENTS,
  type AnalysisSource,
  type ReviewStatus,
  type ReviewTopic,
  type Sentiment,
} from '../enums';

/**
 * Review document — a client's rating of a mover after a move (spec C-14 / A-09).
 * Every review goes through moderation (LLM or rules) before it is public:
 * toxic content lands as FLAGGED and waits for a staff decision.
 */
export interface ReviewModerationDoc {
  source: AnalysisSource;
  sentiment: Sentiment;
  toxic: boolean;
  reasons: string[];
  topics: ReviewTopic[];
  model: string | null;
  createdAt: Date;
}

export interface ReviewDoc {
  clientId: string;
  moverId: string;
  moveReference: string;
  rating: number;
  punctuality: number | null;
  care: number | null;
  communication: number | null;
  comment: string;
  status: ReviewStatus;
  moderation: ReviewModerationDoc | null;
  moderationNote: string | null;
  moderatedBy: string | null;
  moverReply: { text: string; createdAt: Date } | null;
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

const ReviewModerationSchema = new Schema<ReviewModerationDoc>(
  {
    source: { type: String, enum: [...ANALYSIS_SOURCES], required: true },
    sentiment: { type: String, enum: [...SENTIMENTS], required: true },
    toxic: { type: Boolean, default: false },
    reasons: { type: [String], default: [] },
    topics: { type: [String], enum: [...REVIEW_TOPICS], default: [] },
    model: { type: String, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const subScore = { type: Number, min: 1, max: 5, default: null };

const ReviewSchema = new Schema<ReviewDoc>(
  {
    clientId: { type: String, required: true, index: true },
    moverId: { type: String, required: true, index: true },
    moveReference: { type: String, required: true, trim: true, uppercase: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    punctuality: subScore,
    care: subScore,
    communication: subScore,
    comment: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: [...REVIEW_STATUSES], default: 'PUBLISHED', index: true },
    moderation: { type: ReviewModerationSchema, default: null },
    moderationNote: { type: String, default: null },
    moderatedBy: { type: String, default: null },
    moverReply: {
      type: new Schema(
        { text: { type: String, required: true, maxlength: 600 }, createdAt: Date },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

// One review per client, per mover, per move — enforced by the database itself.
ReviewSchema.index({ clientId: 1, moverId: 1, moveReference: 1 }, { unique: true });
ReviewSchema.index({ moverId: 1, status: 1, createdAt: -1 });

export const ReviewModel = (models.Review ?? model('Review', ReviewSchema)) as Model<ReviewDoc>;
