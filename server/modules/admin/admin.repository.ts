import { connectMongo } from '../../shared/database/mongoose';
import { UserModel } from '../../shared/database/models/user.model';
import { MoverProfileModel } from '../../shared/database/models/mover-profile.model';

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
}

export const adminRepository = new AdminRepository();
