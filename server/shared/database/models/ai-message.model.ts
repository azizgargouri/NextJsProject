import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * AiMessage document — persisted assistant conversation (course ch.6:
 * "Sauvegarder les conversations dans MongoDB" via the streamText onFinish callback).
 * Also the source of truth for per-user rate limiting and token accounting.
 */
export const AI_MESSAGE_ROLES = ['user', 'assistant'] as const;
export type AiMessageRole = (typeof AI_MESSAGE_ROLES)[number];

export interface AiMessageDoc {
  userId: string;
  role: AiMessageRole;
  content: string;
  tokens: number;
  model: string | null;
  createdAt: Date;

  _id: Types.ObjectId;
}

const AiMessageSchema = new Schema<AiMessageDoc>(
  {
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: [...AI_MESSAGE_ROLES], required: true },
    content: { type: String, required: true, maxlength: 8000 },
    tokens: { type: Number, default: 0 },
    model: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AiMessageSchema.index({ userId: 1, createdAt: -1 });

export const AiMessageModel = (models.AiMessage ??
  model('AiMessage', AiMessageSchema)) as Model<AiMessageDoc>;
