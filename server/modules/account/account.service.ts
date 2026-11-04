import { connectMongo } from '../../shared/database/mongoose';
import {
  AuditEventModel,
  type AuditEventDoc,
} from '../../shared/database/models/audit-event.model';
import { UserModel } from '../../shared/database/models/user.model';
import { comparePasswords, hashPassword } from '../../shared/auth/password';
import { sha256Hex } from '../../shared/auth/jwt';
import { AlreadyExistsError, NotFoundError, ValidationError } from '../../shared/database/errors';
import { EventType } from '../../shared/logger/audit';
import { storage } from '../../shared/storage/s3';
import { AuthRepository } from '../auth/auth.repository';
import { UserRepository } from '../users/users.repository';
import { serializeUser, type UserResponse } from '../users/users.serializer';
import { avatarKey, inspectAvatar } from './account.avatar';
import type { NotificationsQuery, PasswordChangeInput, ProfileUpdateInput } from './account.schema';

export interface AccountSessionDto {
  id: string;
  userAgent: string | null;
  startedAt: string;
  lastActiveAt: string;
  expiresAt: string;
  current: boolean;
}

export interface AccountNotificationDto {
  id: string;
  event: EventType;
  createdAt: string;
  unread: boolean;
  actor: { id: string; name: string; email: string } | null;
  logInfo: Record<string, unknown>;
}

export interface AccountNotificationsPage {
  data: AccountNotificationDto[];
  unreadCount: number;
  seenAt: string | null;
  nextBefore: string | null;
}

/** Workspace events an administrator is told about when another person triggers them. */
const ADMIN_WORKSPACE_EVENTS: EventType[] = [
  EventType.SIGNUP,
  EventType.USER_CREATE,
  EventType.USER_DELETE,
  EventType.USER_STATUS,
  EventType.PRICING_CREATE,
  EventType.PRICING_UPDATE,
  EventType.PRICING_DELETE,
  EventType.CONTENT_UPDATE,
  EventType.STORAGE_DELETE,
];

/** Security events every account is told about on itself. */
const SELF_SECURITY_EVENTS: EventType[] = [EventType.PASSWORD_CHANGE, EventType.SESSION_REVOKE];

/**
 * Self-service account operations for the signed-in user (any role):
 * profile, avatar in object storage, password, sessions and notifications.
 */
export class AccountService {
  private readonly users = new UserRepository();
  private readonly tokens = new AuthRepository();

  async getProfile(userId: string): Promise<UserResponse> {
    const user = await this.users.findOneById(userId);
    if (!user || user.deletedAt) throw new NotFoundError('User');
    return serializeUser(user);
  }

  async updateProfile(userId: string, input: ProfileUpdateInput): Promise<UserResponse> {
    const existing = await this.users.findOneById(userId);
    if (!existing || existing.deletedAt) throw new NotFoundError('User');

    if (input.phone && input.phone !== existing.phone) {
      const owner = await this.users.findAnyByPhone(input.phone);
      if (owner && owner.id !== userId) throw new AlreadyExistsError('User', 'phone');
    }
    return serializeUser(await this.users.update(userId, { ...input }));
  }

  /** Stores the new avatar first, then swaps the pointer, then removes the old object. */
  async setAvatar(userId: string, bytes: Uint8Array): Promise<UserResponse> {
    const existing = await this.users.findOneById(userId);
    if (!existing || existing.deletedAt) throw new NotFoundError('User');

    const { contentType, ext } = inspectAvatar(bytes);
    const key = avatarKey(userId, ext);
    await storage.putObject(key, bytes, contentType);
    const updated = await this.users.update(userId, { avatarKey: key });

    if (existing.avatarKey && existing.avatarKey !== key) {
      await storage.deleteObject(existing.avatarKey).catch(() => undefined);
    }
    return serializeUser(updated);
  }

  async removeAvatar(userId: string): Promise<UserResponse> {
    const existing = await this.users.findOneById(userId);
    if (!existing || existing.deletedAt) throw new NotFoundError('User');
    if (!existing.avatarKey) return serializeUser(existing);

    const updated = await this.users.update(userId, { avatarKey: null });
    await storage.deleteObject(existing.avatarKey).catch(() => undefined);
    return serializeUser(updated);
  }

  /** Streams the stored avatar of any active user (avatars are profile-public). */
  async readAvatar(userId: string) {
    const user = await this.users.findOneById(userId);
    if (!user || user.deletedAt || !user.avatarKey) throw new NotFoundError('Avatar');
    return storage.getObject(user.avatarKey);
  }

  /**
   * Verifies the current password, stores the new hash and, by default,
   * revokes every other session so stolen refresh tokens stop working.
   */
  async changePassword(
    userId: string,
    input: PasswordChangeInput,
    currentRefreshToken: string | null,
  ): Promise<{ revokedSessions: number }> {
    const user = await this.users.findOneById(userId);
    if (!user || user.deletedAt) throw new NotFoundError('User');

    const ok = await comparePasswords(input.currentPassword, user.passwordHash);
    if (!ok) {
      throw new ValidationError('Current password is incorrect', {
        fieldErrors: { currentPassword: ['Current password is incorrect'] },
      });
    }

    await this.users.update(userId, { passwordHash: await hashPassword(input.newPassword) });

    if (!input.signOutOtherSessions) return { revokedSessions: 0 };
    const current = await this.currentSessionId(currentRefreshToken);
    return { revokedSessions: await this.tokens.revokeAllForUserExcept(userId, current) };
  }

  async listSessions(
    userId: string,
    currentRefreshToken: string | null,
  ): Promise<AccountSessionDto[]> {
    const [sessions, current] = await Promise.all([
      this.tokens.findActiveForUser(userId),
      this.currentSessionId(currentRefreshToken),
    ]);
    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      startedAt: session.sessionStartedAt.toISOString(),
      lastActiveAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === current,
    }));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    currentRefreshToken: string | null,
  ): Promise<void> {
    const current = await this.currentSessionId(currentRefreshToken);
    if (current === sessionId) {
      throw new ValidationError('Use sign out to end the session you are using');
    }
    const revoked = await this.tokens.revokeForUser(userId, sessionId);
    if (!revoked) throw new NotFoundError('Session');
  }

  async revokeOtherSessions(userId: string, currentRefreshToken: string | null): Promise<number> {
    const current = await this.currentSessionId(currentRefreshToken);
    return this.tokens.revokeAllForUserExcept(userId, current);
  }

  async listNotifications(
    userId: string,
    role: UserResponse['role'],
    query: NotificationsQuery,
  ): Promise<AccountNotificationsPage> {
    const user = await this.users.findOneById(userId);
    if (!user || user.deletedAt) throw new NotFoundError('User');

    await connectMongo();
    const scope = this.notificationScope(userId, role);
    const where: Record<string, unknown> = query.before
      ? { $and: [scope, { createdAt: { $lt: new Date(query.before) } }] }
      : scope;
    const seenAt = user.notificationsSeenAt;
    const unreadWhere = seenAt ? { $and: [scope, { createdAt: { $gt: seenAt } }] } : scope;

    const [docs, unreadCount] = await Promise.all([
      AuditEventModel.find(where)
        .sort({ createdAt: -1 })
        .limit(query.limit + 1)
        .lean(),
      AuditEventModel.countDocuments(unreadWhere),
    ]);

    const page = (docs as unknown as AuditEventDoc[]).slice(0, query.limit);
    const actorIds = [...new Set(page.map((doc) => doc.userId).filter(Boolean))] as string[];
    const actors = actorIds.length
      ? await UserModel.find({ _id: { $in: actorIds } })
          .select({ name: 1, email: 1 })
          .lean()
      : [];
    const actorById = new Map(
      actors.map((actor) => [
        String(actor._id),
        { id: String(actor._id), name: actor.name, email: actor.email },
      ]),
    );

    return {
      data: page.map((doc) => ({
        id: String(doc._id),
        event: doc.event as EventType,
        createdAt: doc.createdAt.toISOString(),
        unread: !seenAt || doc.createdAt > seenAt,
        actor: doc.userId ? (actorById.get(doc.userId) ?? null) : null,
        logInfo: doc.logInfo ?? {},
      })),
      unreadCount,
      seenAt: seenAt ? seenAt.toISOString() : null,
      nextBefore:
        docs.length > query.limit ? (page[page.length - 1]?.createdAt.toISOString() ?? null) : null,
    };
  }

  async markNotificationsRead(userId: string): Promise<{ seenAt: string }> {
    const seenAt = new Date();
    await this.users.update(userId, { notificationsSeenAt: seenAt });
    return { seenAt: seenAt.toISOString() };
  }

  private notificationScope(userId: string, role: UserResponse['role']): Record<string, unknown> {
    const clauses: Record<string, unknown>[] = [
      { event: { $in: SELF_SECURITY_EVENTS }, userId },
      // Someone else changed this account (status or profile data).
      {
        event: { $in: [EventType.USER_UPDATE, EventType.USER_STATUS] },
        'logInfo.targetUserId': userId,
        userId: { $ne: userId },
      },
    ];
    if (role === 'ADMIN') {
      clauses.push({ event: { $in: ADMIN_WORKSPACE_EVENTS }, userId: { $ne: userId } });
    }
    return { $or: clauses };
  }

  private async currentSessionId(rawToken: string | null): Promise<string | null> {
    if (!rawToken) return null;
    const stored = await this.tokens.findValidByTokenHash(sha256Hex(rawToken));
    return stored?.id ?? null;
  }
}

export const accountService = new AccountService();
