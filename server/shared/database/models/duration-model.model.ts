import { Schema, model, models, type Model, type Types } from 'mongoose';

export const DURATION_MODEL_STATUSES = ['LIVE', 'RETIRED', 'REJECTED'] as const;
export type DurationModelStatus = (typeof DURATION_MODEL_STATUSES)[number];

/**
 * DurationModel document — one trained version of the job-duration model used
 * by the mover profitability estimate. Every version is kept, so going back is
 * one status change. Only one is LIVE at a time.
 */
export interface DurationModelDoc {
  version: number;
  status: DurationModelStatus;
  features: string[];
  intercept: number;
  weights: number[];
  moverOffsets: { moverId: string; offset: number; jobs: number }[];
  sigma: number;
  sampleSize: number;
  holdoutSize: number;
  /** Mean absolute error in hours on the most recent jobs, held out from training. */
  modelMae: number;
  /** The basic estimate's error on the same jobs: the bar the model has to beat. */
  baselineMae: number;
  /** The previous live model's error on those jobs, when it had not seen them. */
  previousMae: number | null;
  trainedAt: Date;
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

const DurationModelSchema = new Schema<DurationModelDoc>(
  {
    version: { type: Number, required: true, unique: true },
    status: { type: String, enum: [...DURATION_MODEL_STATUSES], required: true, index: true },
    features: { type: [String], required: true },
    intercept: { type: Number, required: true },
    weights: { type: [Number], required: true },
    moverOffsets: {
      type: [
        {
          _id: false,
          moverId: { type: String, required: true },
          offset: { type: Number, required: true },
          jobs: { type: Number, required: true },
        },
      ],
      default: [],
    },
    sigma: { type: Number, required: true },
    sampleSize: { type: Number, required: true },
    holdoutSize: { type: Number, required: true },
    modelMae: { type: Number, required: true },
    baselineMae: { type: Number, required: true },
    previousMae: { type: Number, default: null },
    trainedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const DurationModelModel = (models.DurationModel ??
  model('DurationModel', DurationModelSchema)) as Model<DurationModelDoc>;

/** Single document that stops two servers from training at the same time. */
export interface DurationTrainingDoc {
  _id: string;
  lockedUntil: Date | null;
  /** Finished jobs counted at the last training run, to know when the next is due. */
  jobsAtLastRun: number;
  lastRunAt: Date | null;
}

const DurationTrainingSchema = new Schema<DurationTrainingDoc>(
  {
    _id: { type: String, required: true },
    lockedUntil: { type: Date, default: null },
    jobsAtLastRun: { type: Number, default: 0 },
    lastRunAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const DurationTrainingModel = (models.DurationTraining ??
  model('DurationTraining', DurationTrainingSchema)) as Model<DurationTrainingDoc>;
