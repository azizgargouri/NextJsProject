import { Schema, model, models, type Model, type Types } from 'mongoose';
import { PHOTO_STAGES, type PhotoStage } from '../enums';

export interface PhotoDoc {
  moveId: string;
  uploaderId: string;
  stage: PhotoStage;
  storageKey: string;
  contentType: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

const PhotoSchema = new Schema<PhotoDoc>(
  {
    moveId: { type: String, required: true, index: true },
    uploaderId: { type: String, required: true },
    stage: { type: String, enum: [...PHOTO_STAGES], required: true },
    storageKey: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

export const PhotoModel = (models.Photo ?? model('Photo', PhotoSchema)) as Model<PhotoDoc>;
