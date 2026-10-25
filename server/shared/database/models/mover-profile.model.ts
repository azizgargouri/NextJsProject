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
  bio: string;
  /** Ordered service zone codes, e.g. ["TUN","NBE"] (spec annex, city coder). */
  zones: string[];
  verificationStatus: VerificationStatus;
  ratingAvg: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

const MoverProfileSchema = new Schema<MoverProfileDoc>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    companyName: { type: String, required: true, trim: true },
    bio: { type: String, default: '' },
    zones: { type: [String], default: [] },
    verificationStatus: {
      type: String,
      enum: [...VERIFICATION_STATUSES],
      default: 'PENDING',
    },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

export const MoverProfileModel = (models.MoverProfile ??
  model('MoverProfile', MoverProfileSchema)) as Model<MoverProfileDoc>;
