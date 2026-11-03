import { connectMongo } from '../../shared/database/mongoose';
import { UserModel } from '../../shared/database/models/user.model';
import { MoverProfileModel } from '../../shared/database/models/mover-profile.model';
import {
  AuditEventModel,
  type AuditEventDoc,
} from '../../shared/database/models/audit-event.model';
import { serializeAuditEvent, type AuditEventRow, type EventType } from '../../shared/logger/audit';

/** Mongoose 9 no longer exports FilterQuery; simple clause objects are typed here. */
type AuditEventFilter = Record<string, unknown>;

export interface AdminOverview {
  users: {
    total: number;
    active: number;
    blocked: number;
    clients: number;
    movers: number;
    admins: number;
    registeredLast30Days: number;
  };
  movers: {
    pendingReview: number;
    approved: number;
  };
}

/** Admin read model: real account and mover-profile totals only. */
export class AdminRepository {
  async getOverview(): Promise<AdminOverview> {
    await connectMongo();
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      total,
      active,
      blocked,
      clients,
      movers,
      admins,
      registeredLast30Days,
      pendingReview,
      approved,
    ] = await Promise.all([
      UserModel.countDocuments({ deletedAt: null }),
      UserModel.countDocuments({ deletedAt: null, status: 'ACTIVE' }),
      UserModel.countDocuments({ deletedAt: null, status: 'BLOCKED' }),
      UserModel.countDocuments({ deletedAt: null, role: 'CLIENT' }),
      UserModel.countDocuments({ deletedAt: null, role: 'MOVER' }),
      UserModel.countDocuments({ deletedAt: null, role: 'ADMIN' }),
      UserModel.countDocuments({ deletedAt: null, createdAt: { $gte: last30Days } }),
      MoverProfileModel.countDocuments({ verificationStatus: 'PENDING' }),
      MoverProfileModel.countDocuments({ verificationStatus: 'APPROVED' }),
    ]);

    return {
      users: { total, active, blocked, clients, movers, admins, registeredLast30Days },
      movers: { pendingReview, approved },
    };
  }

  /** Audit trail page with actor identities resolved from the user registry. */
  async listAuditEvents(
    page: number,
    take: number,
    event?: EventType,
  ): Promise<{
    data: (AuditEventRow & { actor: { id: string; name: string; email: string } | null })[];
    meta: {
      page: number;
      take: number;
      itemCount: number;
      pageCount: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    await connectMongo();
    const where: AuditEventFilter = event ? { event } : {};

    const [itemCount, docs] = await Promise.all([
      AuditEventModel.countDocuments(where),
      AuditEventModel.find(where)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .lean<AuditEventDoc[]>(),
    ]);

    const rows = docs.map(serializeAuditEvent);

    // Resolve actor identities in one query so the table can show names, not raw ids.
    const actorIds = [
      ...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id))),
    ];
    const actors = actorIds.length
      ? await UserModel.find({ _id: { $in: actorIds } })
          .select('name email')
          .lean<{ _id: unknown; name: string; email: string }[]>()
      : [];
    const actorById = new Map(
      actors.map((actor) => [
        String(actor._id),
        { id: String(actor._id), name: actor.name, email: actor.email },
      ]),
    );

    return {
      data: rows.map((row) => ({
        ...row,
        actor: row.userId ? (actorById.get(row.userId) ?? null) : null,
      })),
      meta: {
        page,
        take,
        itemCount,
        pageCount: take > 0 ? Math.ceil(itemCount / take) : 0,
        hasPreviousPage: page > 1,
        hasNextPage: page < (take > 0 ? Math.ceil(itemCount / take) : 0),
      },
    };
  }
}

export const adminRepository = new AdminRepository();
