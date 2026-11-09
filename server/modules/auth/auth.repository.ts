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
  userAgent: string | null;
  sessionStartedAt: Date;
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
    userAgent?: string | null;
    sessionStartedAt?: Date | null;
  }): Promise<RefreshTokenRow> {
    const doc = await (
      await this.model()
    ).create({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: new Date(Date.now() + input.ttlSeconds * 1000),
      userAgent: input.userAgent ? input.userAgent.slice(0, 512) : null,
      sessionStartedAt: input.sessionStartedAt ?? new Date(),
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

  /** Active (unrevoked, unexpired) sessions of a user, most recently refreshed first. */
  async findActiveForUser(userId: string): Promise<RefreshTokenRow[]> {
    const docs = await (
      await this.model()
    )
      .find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((doc) => toRow(doc as unknown as RefreshTokenDoc));
  }

  /** Revokes one session only if it belongs to the user; returns whether anything changed. */
  async revokeForUser(userId: string, id: string): Promise<boolean> {
    const result = await (
      await this.model()
    ).updateOne({ _id: id, userId, revokedAt: null }, { revokedAt: new Date() });
    return result.modifiedCount > 0;
  }

  /** Revokes every active session except the one identified by `keepId`. */
  async revokeAllForUserExcept(userId: string, keepId: string | null): Promise<number> {
    const where: Record<string, unknown> = { userId, revokedAt: null };
    if (keepId) where._id = { $ne: keepId };
    const result = await (await this.model()).updateMany(where, { revokedAt: new Date() });
    return result.modifiedCount;
  }

  /** Revokes every active session of a user (used on sign-out and password change). */
  async revokeAllForUser(userId: string): Promise<void> {
    await (await this.model()).updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
  }
}

function toRow(doc: {
  _id: unknown;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent?: string | null;
  sessionStartedAt?: Date | null;
  createdAt: Date;
}): RefreshTokenRow {
  return {
    id: String(doc._id),
    userId: doc.userId,
    tokenHash: doc.tokenHash,
    expiresAt: doc.expiresAt,
    revokedAt: doc.revokedAt ?? null,
    userAgent: doc.userAgent ?? null,
    sessionStartedAt: doc.sessionStartedAt ?? doc.createdAt,
    createdAt: doc.createdAt,
  };
}

export type { RefreshTokenInput };
