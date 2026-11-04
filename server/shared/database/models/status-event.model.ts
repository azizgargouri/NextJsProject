import { Schema, model, models, type Model, type Types } from 'mongoose';

/** Append-only move timeline: every status change is recorded (spec 9.1). */
export interface StatusEventDoc {
  moveId: string;
  fromStatus: string | null;
  toStatus: string;
  note: string;
  /** Null when the system made the change, e.g. 48 h auto-completion. */
  actorId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

const StatusEventSchema = new Schema<StatusEventDoc>(
  {
    moveId: { type: String, required: true, index: true },
    fromStatus: { type: String, default: null },
    toStatus: { type: String, required: true },
    note: { type: String, default: '' },
    actorId: { type: String, default: null },
  },
  { timestamps: true },
);

export const StatusEventModel = (models.StatusEvent ??
  model('StatusEvent', StatusEventSchema)) as Model<StatusEventDoc>;
