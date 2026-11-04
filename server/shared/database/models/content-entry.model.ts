import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * ContentEntry document — one DB-managed copy string per key and locale.
 * Absence of a row means "use the in-code default" (content.constants.ts).
 */
export interface ContentEntryDoc {
  key: string;
  locale: string;
  value: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

const ContentEntrySchema = new Schema<ContentEntryDoc>(
  {
    key: { type: String, required: true },
    locale: { type: String, required: true, enum: ['en', 'fr', 'ar'] },
    value: { type: String, required: true },
    updatedBy: { type: String },
  },
  { timestamps: true },
);

ContentEntrySchema.index({ key: 1, locale: 1 }, { unique: true });

export const ContentEntryModel = (models.ContentEntry ??
  model('ContentEntry', ContentEntrySchema)) as Model<ContentEntryDoc>;
