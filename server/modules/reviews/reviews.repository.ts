import { isValidObjectId } from 'mongoose';
import { connectMongo } from '../../shared/database/mongoose';
import { ReviewModel, type ReviewDoc } from '../../shared/database/models/review.model';
import { MoverProfileModel } from '../../shared/database/models/mover-profile.model';
import type { ReviewStatus } from '../../shared/database/enums';

type ReviewFilter = Record<string, unknown>;

export interface RatingSummary {
  average: number | null;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  punctuality: number | null;
  care: number | null;
  communication: number | null;
}

const round1 = (value: number | null | undefined) =>
  value === null || value === undefined ? null : Math.round(value * 10) / 10;

/** Reviews data access — `reviews` collection + the denormalised rating on mover profiles. */
export class ReviewsRepository {
  private async model() {
    await connectMongo();
    return ReviewModel;
  }

  async create(data: Omit<ReviewDoc, '_id' | 'createdAt' | 'updatedAt'>): Promise<ReviewDoc> {
    const doc = await (await this.model()).create(data);
    return doc.toObject() as ReviewDoc;
  }

  async findById(id: string): Promise<ReviewDoc | null> {
    if (!isValidObjectId(id)) return null;
    return (await this.model()).findById(id).lean<ReviewDoc>();
  }

  async exists(clientId: string, moverId: string, moveReference: string): Promise<boolean> {
    return Boolean(await (await this.model()).exists({ clientId, moverId, moveReference }));
  }

  async paginate(where: ReviewFilter, page: number, take: number) {
    const model = await this.model();
    const [itemCount, docs] = await Promise.all([
      model.countDocuments(where),
      model
        .find(where)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .lean<ReviewDoc[]>(),
    ]);
    return { docs, itemCount };
  }

  async findLatest(where: ReviewFilter, take: number): Promise<ReviewDoc[]> {
    return (await this.model()).find(where).sort({ createdAt: -1 }).limit(take).lean<ReviewDoc[]>();
  }

  async update(id: string, set: Partial<ReviewDoc>): Promise<ReviewDoc | null> {
    return (await this.model())
      .findByIdAndUpdate(id, { $set: set }, { new: true })
      .lean<ReviewDoc>();
  }

  /** Aggregation pipeline: average, count, 1–5 distribution and sub-score means (published only). */
  async summary(moverId?: string): Promise<RatingSummary> {
    const match: ReviewFilter = { status: 'PUBLISHED' };
    if (moverId) match.moverId = moverId;
    const [row] = await (
      await this.model()
    ).aggregate<{
      average: number;
      count: number;
      ratings: number[];
      punctuality: number | null;
      care: number | null;
      communication: number | null;
    }>([
      { $match: match },
      {
        $group: {
          _id: null,
          average: { $avg: '$rating' },
          count: { $sum: 1 },
          ratings: { $push: '$rating' },
          punctuality: { $avg: '$punctuality' },
          care: { $avg: '$care' },
          communication: { $avg: '$communication' },
        },
      },
    ]);
    const distribution: RatingSummary['distribution'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const rating of row?.ratings ?? []) distribution[rating as 1 | 2 | 3 | 4 | 5] += 1;
    return {
      average: round1(row?.average),
      count: row?.count ?? 0,
      distribution,
      punctuality: round1(row?.punctuality),
      care: round1(row?.care),
      communication: round1(row?.communication),
    };
  }

  async countByStatus(): Promise<Record<ReviewStatus, number>> {
    const rows = await (
      await this.model()
    ).aggregate<{ _id: ReviewStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const result: Record<ReviewStatus, number> = { PUBLISHED: 0, FLAGGED: 0, HIDDEN: 0 };
    for (const row of rows) result[row._id] = row.count;
    return result;
  }

  async countNegative(): Promise<number> {
    return (await this.model()).countDocuments({ 'moderation.sentiment': 'NEGATIVE' });
  }

  /** Keeps MoverProfile.ratingAvg / ratingCount in sync with published reviews. */
  async syncMoverRating(moverId: string): Promise<void> {
    const { average, count } = await this.summary(moverId);
    await MoverProfileModel.updateOne(
      { userId: moverId },
      { $set: { ratingAvg: average ?? 0, ratingCount: count } },
    );
  }
}

export const reviewsRepository = new ReviewsRepository();
