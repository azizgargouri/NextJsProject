import { connectMongo } from '../../shared/database/mongoose';
import { MoveRequestModel, MoverProfileModel } from '../../shared/database/models';
import { SERVICE_ZONES } from './mover.constants';

/** Real figures for the public landing page. Nothing here is per-user or private. */
export interface PublicMetrics {
  completedMoves: number;
  approvedMovers: number;
  /** Null until at least one mover has been reviewed. */
  averageRating: { value: number; reviews: number } | null;
  zones: string[];
}

export async function getPublicMetrics(): Promise<PublicMetrics> {
  await connectMongo();
  const [completedMoves, approvedMovers, ratings] = await Promise.all([
    MoveRequestModel.countDocuments({ status: 'COMPLETED' }),
    MoverProfileModel.countDocuments({ verificationStatus: 'APPROVED' }),
    MoverProfileModel.aggregate<{ weighted: number; reviews: number }>([
      { $match: { verificationStatus: 'APPROVED', ratingCount: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          weighted: { $sum: { $multiply: ['$ratingAvg', '$ratingCount'] } },
          reviews: { $sum: '$ratingCount' },
        },
      },
    ]),
  ]);
  const totals = ratings[0];
  return {
    completedMoves,
    approvedMovers,
    averageRating:
      totals && totals.reviews > 0
        ? { value: totals.weighted / totals.reviews, reviews: totals.reviews }
        : null,
    zones: SERVICE_ZONES.map((zone) => zone.label),
  };
}
