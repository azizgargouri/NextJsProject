import { connectMongo } from '../../shared/database/mongoose';
import {
  RefreshTokenModel,
  type RefreshTokenDoc,
} from '../../shared/database/models/refresh-token.model';
import type { RefreshTokenInput } from '../../modules/auth/auth.schema';

export interface RefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * Refresh-token persistence: hashed at rest, one active document per issuance,
 * rotation on every refresh (stored in the `refreshtokens` collection).
 * The TTL index purges documents once expired; revocation is explicit.
 */
export class AuthRepository {
  private async model() {
    await connectMongo();
    return RefreshTokenModel;
  }

  async saveToken(input: {
    userId: string;
    tokenHash: string;
    ttlSeconds: number;
  }): Promise<RefreshTokenRow> {
    const doc = await (await this.model()).create({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: new Date(Date.now() + input.ttlSeconds * 1000),
    });
    return toRow(doc);
  }

  async findValidByTokenHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    const doc = await (await this.model()).findOne({ tokenHash }).lean();
    if (!doc || doc.revokedAt || doc.expiresAt.getTime() < Date.now()) {
      return null;
    }
    return toRow(doc as unknown as RefreshTokenDoc);
  }

  /** Rotation: revoke the used token before issuing a new one. */
  async revoke(id: string): Promise<void> {
    await (await this.model()).updateOne({ _id: id }, { revokedAt: new Date() });
  }

  /** Revokes every active session of a user (used on sign-out and password change). */
  async revokeAllForUser(userId: string): Promise<void> {
    await (await this.model()).updateMany(
      { userId, revokedAt: null },
      { revokedAt: new Date() },
    );
  }
}

function toRow(doc: {
  _id: unknown;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}): RefreshTokenRow {
  return {
    id: String(doc._id),
    userId: doc.userId,
    tokenHash: doc.tokenHash,
    expiresAt: doc.expiresAt,
    revokedAt: doc.revokedAt ?? null,
    createdAt: doc.createdAt,
  };
}

export type { RefreshTokenInput };
