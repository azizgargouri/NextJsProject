import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * Mover photos and documents kept in MongoDB, for hosts without a writable disk
 * or an S3 bucket (e.g. Vercel). Files are capped at 8 MB, well under the 16 MB
 * document limit. Access still goes through short-lived signed URLs only.
 */
export interface MoverFileDoc {
  key: string;
  contentType: string;
  size: number;
  data: Buffer;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

const MoverFileSchema = new Schema<MoverFileDoc>(
  {
    key: { type: String, required: true, unique: true, index: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true },
);

export const MoverFileModel = (models.MoverFile ??
  model('MoverFile', MoverFileSchema)) as Model<MoverFileDoc>;
