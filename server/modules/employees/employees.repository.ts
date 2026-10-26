import type { UpdateQuery } from 'mongoose';
import { AbstractRepository } from '../../shared/database/repository';
import { connectMongo } from '../../shared/database/mongoose';
import { EmployeeModel, type EmployeeDoc } from '../../shared/database/models/employee.model';
import type { EmployeeRole, EmployeeStatus } from '../../shared/database/enums';

/** Repository row: plain object with a string `id` (driver-independent shape). */
export interface EmployeeRow {
  id: string;
  employeeRef: string;
  fullName: string;
  email: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  hireDate: Date | null;
  organization: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Maps a Mongoose document to the repository row (no Document leaks upward). */
export function toEmployeeRow(doc: EmployeeDoc): EmployeeRow {
  return {
    id: String(doc._id),
    employeeRef: doc.employeeRef,
    fullName: doc.fullName,
    email: doc.email,
    role: doc.role,
    status: doc.status,
    hireDate: doc.hireDate ?? null,
    organization: doc.organization ? String(doc.organization) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Employees data access — the only place that knows about the `employees`
 * collection. Every query awaits the shared mongoose connection first.
 */
export class EmployeeRepository extends AbstractRepository<EmployeeRow> {
  private async model() {
    await connectMongo();
    return EmployeeModel;
  }

  async findOneById(id: string): Promise<EmployeeRow | null> {
    const doc = await (await this.model()).findById(id).lean();
    return doc ? toEmployeeRow(doc as unknown as EmployeeDoc) : null;
  }

  async findByEmail(email: string): Promise<EmployeeRow | null> {
    const doc = await (await this.model()).findOne({ email: email.toLowerCase() }).lean();
    return doc ? toEmployeeRow(doc as unknown as EmployeeDoc) : null;
  }

  async findByRef(employeeRef: string): Promise<EmployeeRow | null> {
    const doc = await (await this.model()).findOne({ employeeRef }).lean();
    return doc ? toEmployeeRow(doc as unknown as EmployeeDoc) : null;
  }

  /** Whole directory of one organisation, optionally hiding one record (the caller's own). */
  async findForOrganization(organization: string, excludeId?: string): Promise<EmployeeRow[]> {
    const where: Record<string, unknown> = { organization };
    if (excludeId) where._id = { $ne: excludeId };
    const docs = await (await this.model()).find(where).sort({ employeeRef: 1 }).lean();
    return docs.map((doc) => toEmployeeRow(doc as unknown as EmployeeDoc));
  }

  async create(data: Record<string, unknown>): Promise<EmployeeRow> {
    const doc = await (await this.model()).create(data as Partial<EmployeeDoc>);
    return toEmployeeRow(doc);
  }

  async update(id: string, data: Record<string, unknown>): Promise<EmployeeRow> {
    const doc = await (
      await this.model()
    )
      .findByIdAndUpdate(id, data as UpdateQuery<EmployeeDoc>, { new: true, runValidators: true })
      .lean();
    if (!doc) throw new ReferenceError('Employee not found during update');
    return toEmployeeRow(doc as unknown as EmployeeDoc);
  }

  /** Hard delete — reserved for admin tooling (the local module had no delete endpoint). */
  async delete(id: string): Promise<EmployeeRow> {
    const doc = await (await this.model()).findByIdAndDelete(id).lean();
    if (!doc) throw new ReferenceError('Employee not found during delete');
    return toEmployeeRow(doc as unknown as EmployeeDoc);
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return (await this.model()).countDocuments(where ?? {});
  }

  async findMany(options: Record<string, unknown> = {}): Promise<EmployeeRow[]> {
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
    const docs = await M.find(where).sort(orderBy).skip(skip).limit(limit).lean();
    return docs.map((doc) => toEmployeeRow(doc as unknown as EmployeeDoc));
  }
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
