import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface PayoutDoc {
  moverId: string;
  amount: number;
  currency: string;
  method: string;
  reference: string;
  paidAt: Date;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

const PayoutSchema = new Schema<PayoutDoc>(
  {
    moverId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'TND' },
    method: { type: String, default: 'TRANSFER' },
    reference: { type: String, default: '' },
    paidAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const PayoutModel = (models.Payout ?? model('Payout', PayoutSchema)) as Model<PayoutDoc>;
