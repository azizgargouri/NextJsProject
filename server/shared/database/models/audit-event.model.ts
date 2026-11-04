import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * AuditEvent document — server-side security and administration trail.
 * One row per recorded action (sign-in, user create/update/delete/status…).
 */
export interface AuditEventDoc {
  event: string;
  userId?: string;
  method: string;
  api: string;
  logInfo: Record<string, unknown>;
  createdAt: Date;

  _id: Types.ObjectId;
}

const AuditEventSchema = new Schema<AuditEventDoc>(
  {
    event: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    method: { type: String, required: true },
    api: { type: String, required: true },
    logInfo: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AuditEventSchema.index({ createdAt: -1 });

export const AuditEventModel = (models.AuditEvent ??
  model('AuditEvent', AuditEventSchema)) as Model<AuditEventDoc>;
