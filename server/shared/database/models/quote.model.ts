import { Schema, model, models, type Model, type Types } from 'mongoose';
import { QUOTE_STATUSES, type QuoteStatus } from '../enums';

export interface QuoteDoc {
  moveId: string;
  moverId: string;
  offerId: string;
  amount: number;
  currency: string;
  validUntil: Date;
  message: string;
  status: QuoteStatus;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

const QuoteSchema = new Schema<QuoteDoc>(
  {
    moveId: { type: String, required: true, index: true },
    moverId: { type: String, required: true, index: true },
    offerId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'TND' },
    validUntil: { type: Date, required: true },
    message: { type: String, default: '' },
    status: { type: String, enum: [...QUOTE_STATUSES], default: 'SENT' },
  },
  { timestamps: true },
);

export const QuoteModel = (models.Quote ?? model('Quote', QuoteSchema)) as Model<QuoteDoc>;
