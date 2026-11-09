import { Schema, model, models, type Model, type Types } from 'mongoose';
import { DOCUMENT_TYPES, type DocumentType } from '../enums';

/** A mover's current document of each type; uploading again replaces it. */
export interface MoverDocumentDoc {
  moverId: string;
  type: DocumentType;
  storageKey: string;
  contentType: string;
  fileName: string;
  expiresAt: Date | null;
  /** Set once the 30-day warning has gone out, so it is sent a single time. */
  expiryWarnedAt: Date | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

const MoverDocumentSchema = new Schema<MoverDocumentDoc>(
  {
    moverId: { type: String, required: true },
    type: { type: String, enum: [...DOCUMENT_TYPES], required: true },
    storageKey: { type: String, required: true },
    contentType: { type: String, required: true },
    fileName: { type: String, default: '' },
    expiresAt: { type: Date, default: null, index: true },
    expiryWarnedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

MoverDocumentSchema.index({ moverId: 1, type: 1 }, { unique: true });

export const MoverDocumentModel = (models.MoverDocument ??
  model('MoverDocument', MoverDocumentSchema)) as Model<MoverDocumentDoc>;
