import { connectMongo } from '../../shared/database/mongoose';
import {
  DurationModelModel,
  DurationTrainingModel,
  JobOfferModel,
  MoveRequestModel,
  MoverProfileModel,
  StatusEventModel,
  VehicleModel,
  type DurationModelDoc,
  type MoveRequestDoc,
  type MoverProfileDoc,
  type StatusEventDoc,
  type VehicleDoc,
} from '../../shared/database/models';
import type { MoveStatus } from '../../shared/database/enums';

/** Data access for the job-duration model: training data, versions and the training lock. */
const TRAINING_ID = 'duration';
const FINISHED_STATUSES: MoveStatus[] = ['DELIVERED', 'COMPLETED'];

async function db(): Promise<void> {
  await connectMongo();
}

export const durationRepository = {
  async countFinishedMoves(): Promise<number> {
    await db();
    return MoveRequestModel.countDocuments({
      status: { $in: FINISHED_STATUSES },
      assignedMoverId: { $ne: null },
    });
  },

  async finishedMoves(limit: number): Promise<MoveRequestDoc[]> {
    await db();
    return MoveRequestModel.find({
      status: { $in: FINISHED_STATUSES },
      assignedMoverId: { $ne: null },
    })
      .sort({ deliveredAt: -1, _id: -1 })
      .limit(limit)
      .lean<MoveRequestDoc[]>();
  },

  /** Completed moves with a final price, for the "similar jobs paid" range. */
  async pricedMoves(limit: number): Promise<MoveRequestDoc[]> {
    await db();
    return MoveRequestModel.find({ status: 'COMPLETED', finalPrice: { $ne: null } })
      .sort({ completedAt: -1, _id: -1 })
      .limit(limit)
      .lean<MoveRequestDoc[]>();
  },

  /** Start of loading and delivery, the two events that bound the working time. */
  async workEvents(moveIds: string[]): Promise<StatusEventDoc[]> {
    await db();
    return StatusEventModel.find({
      moveId: { $in: moveIds },
      toStatus: { $in: ['IN_PROGRESS', 'DELIVERED'] },
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean<StatusEventDoc[]>();
  },

  async profiles(moverIds: string[]): Promise<MoverProfileDoc[]> {
    await db();
    return MoverProfileModel.find({ userId: { $in: moverIds } }).lean<MoverProfileDoc[]>();
  },

  async vehicles(moverIds: string[]): Promise<VehicleDoc[]> {
    await db();
    return VehicleModel.find({ moverId: { $in: moverIds } }).lean<VehicleDoc[]>();
  },

  async liveModel(): Promise<DurationModelDoc | null> {
    await db();
    return DurationModelModel.findOne({ status: 'LIVE' })
      .sort({ version: -1 })
      .lean<DurationModelDoc | null>();
  },

  async latestVersion(): Promise<number> {
    await db();
    const latest = await DurationModelModel.findOne()
      .sort({ version: -1 })
      .select('version')
      .lean<{ version: number } | null>();
    return latest?.version ?? 0;
  },

  /** Saves a version; a LIVE one retires every other live version. */
  async saveModel(data: Omit<DurationModelDoc, '_id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await db();
    await DurationModelModel.create(data);
    if (data.status === 'LIVE') {
      await DurationModelModel.updateMany(
        { status: 'LIVE', version: { $ne: data.version } },
        { $set: { status: 'RETIRED' } },
      );
    }
  },

  async trainingState(): Promise<{ jobsAtLastRun: number } | null> {
    await db();
    return DurationTrainingModel.findById(TRAINING_ID)
      .select('jobsAtLastRun')
      .lean<{ jobsAtLastRun: number } | null>();
  },

  /** True when this caller now holds the lock; a held lock makes the upsert collide. */
  async claimTrainingLock(now: Date, holdMs: number): Promise<boolean> {
    await db();
    try {
      const claimed = await DurationTrainingModel.findOneAndUpdate(
        { _id: TRAINING_ID, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] },
        { $set: { lockedUntil: new Date(now.getTime() + holdMs) } },
        { upsert: true, returnDocument: 'after' },
      ).lean();
      return Boolean(claimed);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) return false;
      throw error;
    }
  },

  async releaseTrainingLock(now: Date, jobsAtLastRun: number | null): Promise<void> {
    await db();
    await DurationTrainingModel.updateOne(
      { _id: TRAINING_ID },
      {
        $set: {
          lockedUntil: null,
          lastRunAt: now,
          ...(jobsAtLastRun === null ? {} : { jobsAtLastRun }),
        },
      },
    );
  },

  /** Keeps what the mover was shown when they took the job, to measure accuracy later. */
  async recordOfferEstimate(
    offerId: string,
    estimate: {
      workHoursLikely: number;
      workHoursWorst: number;
      ruleHours: number;
      modelVersion: number | null;
    },
    now: Date,
  ): Promise<void> {
    await db();
    await JobOfferModel.updateOne(
      { _id: offerId },
      { $set: { estimate: { ...estimate, recordedAt: now } } },
    );
  },

  async recordedEstimates(moveIds: string[]) {
    await db();
    return JobOfferModel.find({
      moveId: { $in: moveIds },
      status: 'ACCEPTED',
      estimate: { $ne: null },
    })
      .select('moveId moverId estimate')
      .lean<
        {
          moveId: string;
          moverId: string;
          estimate: { workHoursLikely: number; modelVersion: number | null };
        }[]
      >();
  },
};
