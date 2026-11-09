import { Schema, model, models, type Model, type Types } from 'mongoose';
import { VERIFICATION_STATUSES, type VerificationStatus } from '../enums';

/**
 * MoverProfile document — operator profile attached 1:1 to a MOVER account
 * (spec ch.6: company, service zones and verification workflow).
 */
export interface MoverProfileDoc {
  id: string;
  userId: string;
  companyName: string;
  taxId: string;
  bio: string;
  /** Ordered service zone codes, e.g. ["TUN","NBE"] (spec annex, city coder). */
  zones: string[];
  verificationStatus: VerificationStatus;
  ratingAvg: number;
  ratingCount: number;
  /** Running costs for the profitability estimate; null until the mover enters them. */
  costs: MoverCosts | null;
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

export interface MoverCosts {
  fuelLitresPer100Km: number;
  fuelPricePerLitre: number;
  helpers: number;
  helperHourlyRate: number;
  costPerKm: number;
  targetHourlyNet: number;
}

const MoverCostsSchema = new Schema<MoverCosts>(
  {
    fuelLitresPer100Km: { type: Number, required: true, min: 0 },
    fuelPricePerLitre: { type: Number, required: true, min: 0 },
    helpers: { type: Number, required: true, min: 0 },
    helperHourlyRate: { type: Number, required: true, min: 0 },
    costPerKm: { type: Number, required: true, min: 0 },
    targetHourlyNet: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const MoverProfileSchema = new Schema<MoverProfileDoc>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    companyName: { type: String, required: true, trim: true },
    taxId: { type: String, default: '', trim: true },
    bio: { type: String, default: '' },
    zones: { type: [String], default: [] },
    verificationStatus: {
      type: String,
      enum: [...VERIFICATION_STATUSES],
      default: 'PENDING',
    },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    costs: { type: MoverCostsSchema, default: null },
  },
  { timestamps: true },
);

export const MoverProfileModel = (models.MoverProfile ??
  model('MoverProfile', MoverProfileSchema)) as Model<MoverProfileDoc>;
