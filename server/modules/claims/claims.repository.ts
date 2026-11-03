import { isValidObjectId } from 'mongoose';
import { connectMongo } from '../../shared/database/mongoose';
import {
  ClaimModel,
  type ClaimDoc,
  type ClaimEvent,
} from '../../shared/database/models/claim.model';
import type { ClaimStatus } from '../../shared/database/enums';

/** Mongoose 9 no longer exports FilterQuery; plain clause objects are typed here. */
type ClaimFilter = Record<string, unknown>;

export interface ClaimPage {
  docs: ClaimDoc[];
  itemCount: number;
}

/** Claims data access — the only file that talks to the `claims` collection. */
export class ClaimsRepository {
  private async model() {
    await connectMongo();
    return ClaimModel;
  }

  async create(data: Omit<ClaimDoc, '_id' | 'createdAt' | 'updatedAt'>): Promise<ClaimDoc> {
    const doc = await (await this.model()).create(data);
    return doc.toObject() as ClaimDoc;
  }

  async findById(id: string): Promise<ClaimDoc | null> {
    if (!isValidObjectId(id)) return null;
    return (await this.model()).findById(id).lean<ClaimDoc>();
  }

  async findByReference(reference: string): Promise<ClaimDoc | null> {
    return (await this.model())
      .findOne({ reference: reference.trim().toUpperCase() })
      .lean<ClaimDoc>();
  }

  async findActiveForMove(clientId: string, moveReference: string): Promise<ClaimDoc | null> {
    return (await this.model())
      .findOne({ clientId, moveReference, status: { $in: ['OPEN', 'UNDER_REVIEW'] } })
      .lean<ClaimDoc>();
  }

  async paginate(where: ClaimFilter, page: number, take: number): Promise<ClaimPage> {
    const model = await this.model();
    const [itemCount, docs] = await Promise.all([
      model.countDocuments(where),
      model
        .find(where)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .lean<ClaimDoc[]>(),
    ]);
    return { docs, itemCount };
  }

  async findRecent(where: ClaimFilter, take: number): Promise<ClaimDoc[]> {
    return (await this.model()).find(where).sort({ updatedAt: -1 }).limit(take).lean<ClaimDoc[]>();
  }

  /** Atomic update + timeline append in one round-trip. */
  async update(
    id: string,
    set: Partial<Pick<ClaimDoc, 'status' | 'priority' | 'resolution'>>,
    events: ClaimEvent[],
  ): Promise<ClaimDoc | null> {
    return (await this.model())
      .findByIdAndUpdate(
        id,
        {
          ...(Object.keys(set).length ? { $set: set } : {}),
          $push: { timeline: { $each: events } },
        },
        { new: true },
      )
      .lean<ClaimDoc>();
  }

  async countByStatus(): Promise<Record<ClaimStatus, number>> {
    const rows = await (
      await this.model()
    ).aggregate<{ _id: ClaimStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const result: Record<ClaimStatus, number> = {
      OPEN: 0,
      UNDER_REVIEW: 0,
      RESOLVED: 0,
      REJECTED: 0,
    };
    for (const row of rows) result[row._id] = row.count;
    return result;
  }

  async countOpenUrgent(): Promise<number> {
    return (await this.model()).countDocuments({
      status: { $in: ['OPEN', 'UNDER_REVIEW'] },
      priority: { $in: ['HIGH', 'URGENT'] },
    });
  }

  /** Mean hours between creation and resolution for resolved claims. */
  async averageResolutionHours(): Promise<number | null> {
    const [row] = await (
      await this.model()
    ).aggregate<{ hours: number }>([
      { $match: { status: 'RESOLVED', 'resolution.resolvedAt': { $ne: null } } },
      { $project: { ms: { $subtract: ['$resolution.resolvedAt', '$createdAt'] } } },
      { $group: { _id: null, hours: { $avg: { $divide: ['$ms', 3_600_000] } } } },
    ]);
    return row ? Math.round(row.hours * 10) / 10 : null;
  }
}

export const claimsRepository = new ClaimsRepository();
