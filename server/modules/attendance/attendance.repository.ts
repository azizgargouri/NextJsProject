import type { UpdateQuery } from 'mongoose';
import { AbstractRepository } from '../../shared/database/repository';
import { connectMongo } from '../../shared/database/mongoose';
import {
  AttendanceModel,
  type AttendanceDoc,
  type AttendanceLocation,
} from '../../shared/database/models/attendance.model';
import type { AttendanceStatus } from '../../shared/database/enums';

/** Embedded employee reference returned alongside every attendance row. */
export interface AttendanceEmployeeRef {
  id: string;
  employeeRef: string;
  fullName: string;
}

/** Repository row: plain object with a string `id` (driver-independent shape). */
export interface AttendanceRow {
  id: string;
  employeeId: string;
  employee: AttendanceEmployeeRef | null;
  workDate: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  status: AttendanceStatus;
  breakDuration: number;
  location: AttendanceLocation | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PopulatedEmployee {
  _id: unknown;
  employeeRef?: string;
  fullName?: string;
}

/** Maps a (possibly populated) Mongoose document to the repository row. */
export function toAttendanceRow(doc: AttendanceDoc): AttendanceRow {
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
    workDate: doc.workDate,
    clockIn: doc.clockIn ?? null,
    clockOut: doc.clockOut ?? null,
    status: doc.status,
    breakDuration: doc.breakDuration ?? 0,
    location: doc.location ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Attendance data access — the only place that knows about the `attendance`
 * collection. Range reads always populate the employee reference.
 */
export class AttendanceRepository extends AbstractRepository<AttendanceRow> {
  private async model() {
    await connectMongo();
    return AttendanceModel;
  }

  async findOneById(id: string): Promise<AttendanceRow | null> {
    const doc = await (await this.model()).findById(id).lean();
    return doc ? toAttendanceRow(doc as unknown as AttendanceDoc) : null;
  }

  /** All records for a set of employees inside [from, to). */
  async findRange(options: {
    from: Date;
    to: Date;
    employeeIds?: string[];
  }): Promise<AttendanceRow[]> {
    const where: Record<string, unknown> = { workDate: { $gte: options.from, $lt: options.to } };
    if (options.employeeIds) where.employee = { $in: options.employeeIds };

    const docs = await (
      await this.model()
    )
      .find(where)
      .populate('employee', 'employeeRef fullName')
      .sort({ workDate: 1, clockIn: 1 })
      .lean();

    return docs.map((doc) => toAttendanceRow(doc as unknown as AttendanceDoc));
  }

  /** One employee's record inside a single day (check-in lookup). */
  async findByDay(employeeId: string, dayStart: Date, dayEnd: Date): Promise<AttendanceRow | null> {
    const doc = await (
      await this.model()
    )
      .findOne({ employee: employeeId, workDate: { $gte: dayStart, $lt: dayEnd } })
      .populate('employee', 'employeeRef fullName')
      .lean();
    return doc ? toAttendanceRow(doc as unknown as AttendanceDoc) : null;
  }

  async create(data: Record<string, unknown>): Promise<AttendanceRow> {
    const doc = await (await this.model()).create(data as Partial<AttendanceDoc>);
    return toAttendanceRow(doc);
  }

  async update(id: string, data: Record<string, unknown>): Promise<AttendanceRow> {
    const doc = await (
      await this.model()
    )
      .findByIdAndUpdate(id, data as UpdateQuery<AttendanceDoc>, { new: true })
      .lean();
    if (!doc) throw new ReferenceError('Attendance not found during update');
    return toAttendanceRow(doc as unknown as AttendanceDoc);
  }

  async delete(id: string): Promise<AttendanceRow> {
    const doc = await (await this.model()).findByIdAndDelete(id).lean();
    if (!doc) throw new ReferenceError('Attendance not found during delete');
    return toAttendanceRow(doc as unknown as AttendanceDoc);
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return (await this.model()).countDocuments(where ?? {});
  }

  async findMany(options: Record<string, unknown> = {}): Promise<AttendanceRow[]> {
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
    return docs.map((doc) => toAttendanceRow(doc as unknown as AttendanceDoc));
  }
}
