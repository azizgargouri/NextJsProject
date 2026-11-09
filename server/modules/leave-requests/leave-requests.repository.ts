import type { UpdateQuery } from 'mongoose';
import { AbstractRepository } from '../../shared/database/repository';
import { connectMongo } from '../../shared/database/mongoose';
import {
  LeaveRequestModel,
  type LeaveRequestDoc,
} from '../../shared/database/models/leave-request.model';
import type { LeaveStatus, LeaveType } from '../../shared/database/enums';

/** Embedded employee reference returned alongside every leave row. */
export interface LeaveEmployeeRef {
  id: string;
  employeeRef: string;
  fullName: string;
}

/** Repository row: plain object with a string `id` (driver-independent shape). */
export interface LeaveRequestRow {
  id: string;
  employeeId: string;
  employee: LeaveEmployeeRef | null;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  daysRequested: number;
  status: LeaveStatus;
  reason: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PopulatedEmployee {
  _id: unknown;
  employeeRef?: string;
  fullName?: string;
}

/** Maps a (possibly populated) Mongoose document to the repository row. */
export function toLeaveRequestRow(doc: LeaveRequestDoc): LeaveRequestRow {
  const populated = doc.employee as unknown as PopulatedEmployee;
  const isPopulated = Boolean(populated && typeof populated === 'object' && populated.employeeRef);

  return {
    id: String(doc._id),
    employeeId: isPopulated ? String(populated._id) : String(doc.employee),
    employee: isPopulated
      ? {
          id: String(populated._id),
          employeeRef: populated.employeeRef ?? '',
          fullName: populated.fullName ?? 'Unknown employee',
        }
      : null,
    type: doc.type,
    startDate: doc.startDate,
    endDate: doc.endDate,
    daysRequested: doc.daysRequested,
    status: doc.status,
    reason: doc.reason ?? null,
    approvedBy: doc.approvedBy ? String(doc.approvedBy) : null,
    approvedAt: doc.approvedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Leave-request data access — the only place that knows about the collection. */
export class LeaveRequestRepository extends AbstractRepository<LeaveRequestRow> {
  private async model() {
    await connectMongo();
    return LeaveRequestModel;
  }

  async findOneById(id: string): Promise<LeaveRequestRow | null> {
    const doc = await (
      await this.model()
    )
      .findById(id)
      .populate('employee', 'employeeRef fullName')
      .lean();
    return doc ? toLeaveRequestRow(doc as unknown as LeaveRequestDoc) : null;
  }

  /** Scoped list (employee ids + optional status), newest first, capped like the local module. */
  async findScoped(options: {
    employeeIds: string[];
    status?: LeaveRequestRow['status'];
    limit?: number;
  }): Promise<LeaveRequestRow[]> {
    if (options.employeeIds.length === 0) return [];

    const where: Record<string, unknown> = { employee: { $in: options.employeeIds } };
    if (options.status) where.status = options.status;

    const docs = await (
      await this.model()
    )
      .find(where)
      .populate('employee', 'employeeRef fullName')
      .sort({ createdAt: -1 })
      .limit(options.limit ?? 100)
      .lean();

    return docs.map((doc) => toLeaveRequestRow(doc as unknown as LeaveRequestDoc));
  }

  async create(data: Record<string, unknown>): Promise<LeaveRequestRow> {
    const doc = await (await this.model()).create(data as Partial<LeaveRequestDoc>);
    return toLeaveRequestRow(doc);
  }

  async update(id: string, data: Record<string, unknown>): Promise<LeaveRequestRow> {
    const doc = await (
      await this.model()
    )
      .findByIdAndUpdate(id, data as UpdateQuery<LeaveRequestDoc>, { new: true })
      .populate('employee', 'employeeRef fullName')
      .lean();
    if (!doc) throw new ReferenceError('Leave request not found during update');
    return toLeaveRequestRow(doc as unknown as LeaveRequestDoc);
  }

  async delete(id: string): Promise<LeaveRequestRow> {
    const doc = await (await this.model()).findByIdAndDelete(id).lean();
    if (!doc) throw new ReferenceError('Leave request not found during delete');
    return toLeaveRequestRow(doc as unknown as LeaveRequestDoc);
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return (await this.model()).countDocuments(where ?? {});
  }

  async findMany(options: Record<string, unknown> = {}): Promise<LeaveRequestRow[]> {
    const M = await this.model();
    const {
      where = {},
      orderBy = {},
      skip = 0,
      limit = 50,
    } = (options ?? {}) as {
      where?: Record<string, unknown>;
      orderBy?: Record<string, 'asc' | 'desc'>;
      skip?: number;
      limit?: number;
    };
    const docs = await M.find(where)
      .sort(orderBy)
      .skip(skip)
      .limit(limit)
      .populate('employee', 'employeeRef fullName')
      .lean();
    return docs.map((doc) => toLeaveRequestRow(doc as unknown as LeaveRequestDoc));
  }
}
