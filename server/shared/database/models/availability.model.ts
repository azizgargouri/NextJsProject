import { Schema, model, models, type Model, type Types } from 'mongoose';
import { TIME_SLOTS, type TimeSlot } from '../enums';

/** A day a mover is free. One row per day; no row means unavailable. */
export interface AvailabilityDoc {
  moverId: string;
  date: string;
  slot: TimeSlot;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

const AvailabilitySchema = new Schema<AvailabilityDoc>(
  {
    moverId: { type: String, required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    slot: { type: String, enum: [...TIME_SLOTS], required: true },
  },
  { timestamps: true },
);

AvailabilitySchema.index({ moverId: 1, date: 1 }, { unique: true });

export const AvailabilityModel = (models.Availability ??
  model('Availability', AvailabilitySchema)) as Model<AvailabilityDoc>;
