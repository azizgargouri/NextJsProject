import { Schema, model, models, type Model, type Types } from 'mongoose';
import { PRICING_STATUSES } from '../enums';

/**
 * PricingRule document — the quote formula an admin tunes in the back office.
 * Only one ACTIVE rule is valid at a time (service enforces exclusivity).
 */
export interface PricingRuleDoc {
  id: string;
  name: string;
  status: (typeof PRICING_STATUSES)[number];
  currency: string;
  baseFare: number;
  perKm: number;
  perM3: number;
  /** Express service surcharge in percent of the computed total (0–100). */
  expressSurcharge: number;
  minQuote: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  /** Bumped on every mutation for a visible change history trail. */
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  _id: Types.ObjectId;
}

const PricingRuleSchema = new Schema<PricingRuleDoc>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: [...PRICING_STATUSES], default: 'ACTIVE' },
    currency: { type: String, default: 'TND' },
    baseFare: { type: Number, required: true, min: 0 },
    perKm: { type: Number, required: true, min: 0 },
    perM3: { type: Number, required: true, min: 0 },
    expressSurcharge: { type: Number, required: true, min: 0, max: 100 },
    minQuote: { type: Number, required: true, min: 0 },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    version: { type: Number, default: 1 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const PricingRuleModel = (models.PricingRule ??
  model('PricingRule', PricingRuleSchema)) as Model<PricingRuleDoc>;
