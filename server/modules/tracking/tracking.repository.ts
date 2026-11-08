import { Types, type UpdateQuery } from 'mongoose';
import { AbstractRepository } from '../../shared/database/repository';
import { connectMongo } from '../../shared/database/mongoose';
import {
  TrackingSessionModel,
  type TrackingSessionDoc,
} from '../../shared/database/models/tracking-session.model';
import {
  LocationPingModel,
  type LocationPingDoc,
} from '../../shared/database/models/location-ping.model';
import type {
  LocationPingSource,
  TrackingSessionStatus,
} from '../../shared/database/enums';

export interface TrackingSessionRow {
  id: string;
  organization: string;
  employeeId: string;
  attendanceId: string;
  crewId: string | null;
  crewName: string | null;
  workDate: Date;
  startedAt: Date;
  endedAt: Date | null;
  lastPingAt: Date | null;
  pingCount: number;
  intervalMinutes: number;
  status: TrackingSessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationPingRow {
  id: string;
  organization: string;
  employeeId: string;
  attendanceId: string;
  sessionId: string;
  crewId: string | null;
  crewName: string | null;
  at: Date;
  lat: number;
  lng: number;
  accuracy: number | null;
  source: LocationPingSource;
  createdAt: Date;
}

export function toTrackingSessionRow(doc: TrackingSessionDoc): TrackingSessionRow {
  return {
    id: String(doc._id),
    organization: String(doc.organization),
    employeeId: String(doc.employee),
    attendanceId: String(doc.attendance),
    crewId: doc.crew ? String(doc.crew) : null,
    crewName: doc.crewName ?? null,
    workDate: doc.workDate,
    startedAt: doc.startedAt,
    endedAt: doc.endedAt ?? null,
    lastPingAt: doc.lastPingAt ?? null,
    pingCount: doc.pingCount ?? 0,
    intervalMinutes: doc.intervalMinutes ?? 5,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function toLocationPingRow(doc: LocationPingDoc): LocationPingRow {
  return {
    id: String(doc._id),
    organization: String(doc.organization),
    employeeId: String(doc.employee),
    attendanceId: String(doc.attendance),
    sessionId: String(doc.session),
    crewId: doc.crew ? String(doc.crew) : null,
    crewName: doc.crewName ?? null,
    at: doc.at,
    lat: doc.lat,
    lng: doc.lng,
    accuracy: doc.accuracy ?? null,
    source: doc.source,
    createdAt: doc.createdAt,
  };
}

/**
 * Tracking data access. Sessions are the aggregate root; every ping belongs to
 * exactly one session, and history is always read through organisation scope.
 */
export class TrackingRepository extends AbstractRepository<TrackingSessionRow> {
  private async sessionModel() {
    await connectMongo();
    return TrackingSessionModel;
  }

  private async pingModel() {
    await connectMongo();
    return LocationPingModel;
  }

  async findOneById(id: string): Promise<TrackingSessionRow | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await (await this.sessionModel()).findById(id).lean();
    return doc ? toTrackingSessionRow(doc as unknown as TrackingSessionDoc) : null;
  }

  async findSessionByDay(
    employeeId: string,
    dayStart: Date,
    dayEnd: Date,
  ): Promise<TrackingSessionRow | null> {
    const doc = await (await this.sessionModel())
      .findOne({ employee: employeeId, workDate: { $gte: dayStart, $lt: dayEnd } })
      .lean();
    return doc ? toTrackingSessionRow(doc as unknown as TrackingSessionDoc) : null;
  }

  async findSessionsForEmployee(
    employeeId: string,
    from: Date,
    to: Date,
  ): Promise<TrackingSessionRow[]> {
    const docs = await (await this.sessionModel())
      .find({ employee: employeeId, workDate: { $gte: from, $lt: to } })
      .sort({ startedAt: 1 })
      .lean();
    return docs.map((doc) => toTrackingSessionRow(doc as unknown as TrackingSessionDoc));
  }

  /**
   * Lazily closes sessions left open on earlier days. This keeps history honest
   * without requiring a background scheduler in the Next.js runtime.
   */
  async closeOpenSessionsBefore(employeeId: string, before: Date): Promise<void> {
    const M = await this.sessionModel();
    const open = await M.find({
      employee: employeeId,
      status: 'active',
      workDate: { $lt: before },
    })
      .select('_id lastPingAt startedAt')
      .lean();

    await Promise.all(
      open.map((doc) =>
        M.updateOne(
          { _id: doc._id },
          {
            $set: {
              status: 'ended',
              endedAt: doc.lastPingAt ?? doc.startedAt,
            },
          },
        ),
      ),
    );
  }

  async findPingsForEmployee(
    organization: string,
    employeeId: string,
    from: Date,
    to: Date,
    maxAccuracyM?: number,
  ): Promise<LocationPingRow[]> {
    const where: Record<string, unknown> = {
      organization,
      employee: employeeId,
      at: { $gte: from, $lt: to },
    };

    if (maxAccuracyM !== undefined) {
      where.$or = [
        { accuracy: null },
        { accuracy: { $exists: false } },
        { accuracy: { $lte: maxAccuracyM } },
      ];
    }

    const docs = await (await this.pingModel())
      .find(where)
      .sort({ at: 1 })
      .lean();
    return docs.map((doc) => toLocationPingRow(doc as unknown as LocationPingDoc));
  }

  async createPing(data: Record<string, unknown>): Promise<LocationPingRow> {
    const doc = await (await this.pingModel()).create(data as Partial<LocationPingDoc>);
    return toLocationPingRow(doc);
  }

  /** Atomically records the latest ping time and increments the sample count. */
  async addPing(sessionId: string, at: Date): Promise<TrackingSessionRow> {
    const doc = await (await this.sessionModel())
      .findByIdAndUpdate(
        sessionId,
        {
          $set: { lastPingAt: at, status: 'active' },
          $inc: { pingCount: 1 },
        },
        { new: true },
      )
      .lean();
    if (!doc) throw new ReferenceError('Tracking session not found during ping');
    return toTrackingSessionRow(doc as unknown as TrackingSessionDoc);
  }

  async endSession(sessionId: string, at: Date): Promise<TrackingSessionRow> {
    const doc = await (await this.sessionModel())
      .findByIdAndUpdate(
        sessionId,
        { $set: { status: 'ended', endedAt: at } },
        { new: true },
      )
      .lean();
    if (!doc) throw new ReferenceError('Tracking session not found during stop');
    return toTrackingSessionRow(doc as unknown as TrackingSessionDoc);
  }

  async create(data: Record<string, unknown>): Promise<TrackingSessionRow> {
    const doc = await (await this.sessionModel()).create(
      data as Partial<TrackingSessionDoc>,
    );
    return toTrackingSessionRow(doc);
  }

  async update(id: string, data: Record<string, unknown>): Promise<TrackingSessionRow> {
    const doc = await (await this.sessionModel())
      .findByIdAndUpdate(id, data as UpdateQuery<TrackingSessionDoc>, {
        new: true,
        runValidators: true,
      })
      .lean();
    if (!doc) throw new ReferenceError('Tracking session not found during update');
    return toTrackingSessionRow(doc as unknown as TrackingSessionDoc);
  }

  async delete(id: string): Promise<TrackingSessionRow> {
    const doc = await (await this.sessionModel()).findByIdAndDelete(id).lean();
    if (!doc) throw new ReferenceError('Tracking session not found during delete');
    return toTrackingSessionRow(doc as unknown as TrackingSessionDoc);
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return (await this.sessionModel()).countDocuments(where ?? {});
  }

  async findMany(options: Record<string, unknown> = {}): Promise<TrackingSessionRow[]> {
    const M = await this.sessionModel();
    const {
      where = {},
      orderBy = { startedAt: 1 },
      skip = 0,
      limit = 50,
    } = (options ?? {}) as {
      where?: Record<string, unknown>;
      orderBy?: Record<string, 1 | -1>;
      skip?: number;
      limit?: number;
    };
    const docs = await M.find(where).sort(orderBy).skip(skip).limit(limit).lean();
    return docs.map((doc) => toTrackingSessionRow(doc as unknown as TrackingSessionDoc));
  }
}
