import { Schema, model, models, type Model, type Types } from 'mongoose';
import { EARNING_STATUSES, type EarningStatus } from '../enums';

/**
 * What a completed move earned. The commission rate is copied here so later
 * pricing changes never rewrite past earnings.
 */
export interface EarningDoc {
  moveId: string;
  moverId: string;
  reference: string;
  gross: number;
  commissionRate: number;
  commission: number;
  net: number;
  currency: string;
  status: EarningStatus;
  payoutId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

const EarningSchema = new Schema<EarningDoc>(
  {
    moveId: { type: String, required: true, unique: true },
    moverId: { type: String, required: true, index: true },
    reference: { type: String, required: true },
    gross: { type: Number, required: true, min: 0 },
    commissionRate: { type: Number, required: true, min: 0, max: 1 },
    commission: { type: Number, required: true, min: 0 },
    net: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'TND' },
    status: { type: String, enum: [...EARNING_STATUSES], default: 'PENDING' },
    payoutId: { type: String, default: null },
  },
  { timestamps: true },
);

export const EarningModel = (models.Earning ??
  model('Earning', EarningSchema)) as Model<EarningDoc>;
