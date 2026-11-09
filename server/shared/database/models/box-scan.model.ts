import { Schema, model, models, type Model, type Types } from 'mongoose';

/** One box scanned into the vehicle at the pickup address. */
export interface BoxScanDoc {
  moveId: string;
  moverId: string;
  /** Exactly what the QR code holds. */
  code: string;
  /** Short name shown to the mover, e.g. "Box 7". */
  label: string;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

const BoxScanSchema = new Schema<BoxScanDoc>(
  {
    moveId: { type: String, required: true },
    moverId: { type: String, required: true },
    code: { type: String, required: true },
    label: { type: String, required: true },
  },
  { timestamps: true },
);

// A box counts once per move, even when two scans of it arrive together.
BoxScanSchema.index({ moveId: 1, code: 1 }, { unique: true });

export const BoxScanModel = (models.BoxScan ??
  model('BoxScan', BoxScanSchema)) as Model<BoxScanDoc>;
