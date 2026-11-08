import { Types, type UpdateQuery } from 'mongoose';
import { AbstractRepository } from '../../shared/database/repository';
import { connectMongo } from '../../shared/database/mongoose';
import { CrewModel, type CrewDoc } from '../../shared/database/models/crew.model';
import type { CrewStatus, EmployeeRole, EmployeeStatus } from '../../shared/database/enums';

export interface CrewMemberRow {
  id: string;
  employeeRef: string;
  fullName: string;
  role: EmployeeRole;
  status: EmployeeStatus;
}

/** Repository row: plain object with string ids (no Mongoose documents leak). */
export interface CrewRow {
  id: string;
  name: string;
  code: string | null;
  organization: string;
  leaderId: string | null;
  members: CrewMemberRow[];
  status: CrewStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PopulatedMember {
  _id: unknown;
  employeeRef?: string;
  fullName?: string;
  role?: EmployeeRole;
  status?: EmployeeStatus;
}

function toMember(member: unknown): CrewMemberRow | null {
  if (!member || typeof member !== 'object') return null;
  const populated = member as PopulatedMember;
  if (!populated._id || !populated.employeeRef) return null;

  return {
    id: String(populated._id),
    employeeRef: populated.employeeRef,
    fullName: populated.fullName ?? 'Unknown employee',
    role: populated.role ?? 'employee',
    status: populated.status ?? 'active',
  };
}

export function toCrewRow(doc: CrewDoc): CrewRow {
  const members = (doc.members as unknown as unknown[])
    .map(toMember)
    .filter((member): member is CrewMemberRow => member !== null);

  return {
    id: String(doc._id),
    name: doc.name,
    code: doc.code ?? null,
    organization: String(doc.organization),
    leaderId: doc.leader ? String(doc.leader) : null,
    members,
    status: doc.status,
    notes: doc.notes ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Crew data access — the only place that knows about the `crews` collection.
 * Member references are always populated so serializers never expose raw ids.
 */
export class CrewRepository extends AbstractRepository<CrewRow> {
  private async model() {
    await connectMongo();
    return CrewModel;
  }

  async findOneById(id: string): Promise<CrewRow | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await (await this.model())
      .findById(id)
      .populate('members', 'employeeRef fullName role status')
      .lean();
    return doc ? toCrewRow(doc as unknown as CrewDoc) : null;
  }

  async findOneInOrganization(id: string, organization: string): Promise<CrewRow | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await (await this.model())
      .findOne({ _id: id, organization })
      .populate('members', 'employeeRef fullName role status')
      .lean();
    return doc ? toCrewRow(doc as unknown as CrewDoc) : null;
  }

  async findForOrganization(
    organization: string,
    options: { status?: CrewStatus; search?: string } = {},
  ): Promise<CrewRow[]> {
    const where: Record<string, unknown> = { organization };
    if (options.status) where.status = options.status;
    if (options.search) {
      where.name = { $regex: escapeRegExp(options.search), $options: 'i' };
    }

    const docs = await (await this.model())
      .find(where)
      .populate('members', 'employeeRef fullName role status')
      .sort({ name: 1 })
      .lean();
    return docs.map((doc) => toCrewRow(doc as unknown as CrewDoc));
  }

  async findByNameInOrganization(name: string, organization: string): Promise<CrewRow | null> {
    const doc = await (await this.model())
      .findOne({ name, organization })
      .populate('members', 'employeeRef fullName role status')
      .lean();
    return doc ? toCrewRow(doc as unknown as CrewDoc) : null;
  }

  async findByCodeInOrganization(code: string, organization: string): Promise<CrewRow | null> {
    const doc = await (await this.model())
      .findOne({ code, organization })
      .populate('members', 'employeeRef fullName role status')
      .lean();
    return doc ? toCrewRow(doc as unknown as CrewDoc) : null;
  }

  /** Active crews that contain at least one of the supplied employees. */
  async findActiveByEmployeeIds(
    organization: string,
    employeeIds: string[],
  ): Promise<CrewRow[]> {
    if (employeeIds.length === 0) return [];
    const docs = await (await this.model())
      .find({ organization, status: 'active', members: { $in: employeeIds } })
      .populate('members', 'employeeRef fullName role status')
      .lean();
    return docs.map((doc) => toCrewRow(doc as unknown as CrewDoc));
  }

  /** The active crew assigned to one employee, if any. */
  async findActiveForEmployee(
    organization: string,
    employeeId: string,
  ): Promise<CrewRow | null> {
    const doc = await (await this.model())
      .findOne({ organization, status: 'active', members: employeeId })
      .populate('members', 'employeeRef fullName role status')
      .sort({ updatedAt: -1 })
      .lean();
    return doc ? toCrewRow(doc as unknown as CrewDoc) : null;
  }

  async create(data: Record<string, unknown>): Promise<CrewRow> {
    const doc = await (await this.model()).create(data as Partial<CrewDoc>);
    const row = await this.findOneById(String(doc._id));
    if (!row) throw new ReferenceError('Crew not found after create');
    return row;
  }

  async update(id: string, data: Record<string, unknown>): Promise<CrewRow> {
    const doc = await (
      await this.model()
    )
      .findByIdAndUpdate(id, data as UpdateQuery<CrewDoc>, {
        new: true,
        runValidators: true,
      })
      .lean();
    if (!doc) throw new ReferenceError('Crew not found during update');

    const row = await this.findOneById(id);
    if (!row) throw new ReferenceError('Crew not found after update');
    return row;
  }

  async delete(id: string): Promise<CrewRow> {
    const doc = await (await this.model()).findByIdAndDelete(id).lean();
    if (!doc) throw new ReferenceError('Crew not found during delete');
    return toCrewRow(doc as unknown as CrewDoc);
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return (await this.model()).countDocuments(where ?? {});
  }

  async findMany(options: Record<string, unknown> = {}): Promise<CrewRow[]> {
    const M = await this.model();
    const {
      where = {},
      orderBy = { name: 1 },
      skip = 0,
      limit = 50,
    } = (options ?? {}) as {
      where?: Record<string, unknown>;
      orderBy?: Record<string, 1 | -1>;
      skip?: number;
      limit?: number;
    };
    const docs = await M.find(where)
      .populate('members', 'employeeRef fullName role status')
      .sort(orderBy)
      .skip(skip)
      .limit(limit)
      .lean();
    return docs.map((doc) => toCrewRow(doc as unknown as CrewDoc));
  }
}
