import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * Voice check-in attempt — one record per employee attempt.
 * Used by the RH dashboard to spot different-voice / mismatched attempts.
 */
export interface VoiceCheckinDoc {
  id: string;
  userId: Types.ObjectId;
  employeeId: Types.ObjectId | null;
  employeeRef: string;
  decision: string;
  speakerScore: number;
  voiceLabel: string;
  challengeOk: boolean;
  jobOk: boolean;
  distanceM: number;
  reasons: string[];
  createdAt: Date;
  _id: Types.ObjectId;
}

const VoiceCheckinSchema = new Schema<VoiceCheckinDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
    employeeRef: { type: String, required: true, trim: true, index: true },
    decision: { type: String, required: true, index: true },
    speakerScore: { type: Number, required: true },
    voiceLabel: { type: String, required: true },
    challengeOk: { type: Boolean, required: true },
    jobOk: { type: Boolean, required: true },
    distanceM: { type: Number, required: true },
    reasons: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const VoiceCheckinModel = (models.VoiceCheckin ?? model('VoiceCheckin', VoiceCheckinSchema)) as Model<VoiceCheckinDoc>;
