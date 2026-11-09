import { Schema, model, models, type Model, type Types } from 'mongoose';
import { OFFER_STATUSES, type OfferStatus } from '../enums';

/** A move proposed to one mover, open until `expiresAt` (spec 9.3). */
export interface JobOfferDoc {
  moveId: string;
  moverId: string;
  status: OfferStatus;
  expiresAt: Date;
  respondedAt: Date | null;
  declineReason: string;
  /** The duration estimate the mover saw when they accepted or quoted, kept to measure accuracy. */
  estimate: OfferEstimate | null;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

export interface OfferEstimate {
  workHoursLikely: number;
  workHoursWorst: number;
  ruleHours: number;
  modelVersion: number | null;
  recordedAt: Date;
}

const OfferEstimateSchema = new Schema<OfferEstimate>(
  {
    workHoursLikely: { type: Number, required: true },
    workHoursWorst: { type: Number, required: true },
    ruleHours: { type: Number, required: true },
    modelVersion: { type: Number, default: null },
    recordedAt: { type: Date, required: true },
  },
  { _id: false },
);

const JobOfferSchema = new Schema<JobOfferDoc>(
  {
    estimate: { type: OfferEstimateSchema, default: null },
    moveId: { type: String, required: true },
    moverId: { type: String, required: true },
    status: { type: String, enum: [...OFFER_STATUSES], default: 'PENDING' },
    expiresAt: { type: Date, required: true },
    respondedAt: { type: Date, default: null },
    declineReason: { type: String, default: '' },
  },
  { timestamps: true },
);

// A mover is offered a given move at most once, which also makes hand-off idempotent.
JobOfferSchema.index({ moveId: 1, moverId: 1 }, { unique: true });
JobOfferSchema.index({ moverId: 1, status: 1, expiresAt: 1 });
JobOfferSchema.index({ status: 1, expiresAt: 1 });

export const JobOfferModel = (models.JobOffer ??
  model('JobOffer', JobOfferSchema)) as Model<JobOfferDoc>;
