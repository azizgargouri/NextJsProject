import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * RefreshToken document — one per issued refresh token, hashed at rest.
 * `expiresAt` carries a TTL index so Mongo purges consumed/expired sessions.
 */
export interface RefreshTokenDoc {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;

  _id: Types.ObjectId;
}

const RefreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    userId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    // TTL index (expires: 0) purges the document the moment expiresAt passes.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const RefreshTokenModel = (models.RefreshToken ??
  model('RefreshToken', RefreshTokenSchema)) as Model<RefreshTokenDoc>;
