import {
  AlreadyExistsError,
  BadRequestError,
  NotFoundError,
} from '../../shared/database/errors';
import { employeesService } from '../employees/employees.service';
import type { EmployeeRow } from '../employees/employees.repository';
import { CrewRepository, type CrewRow } from './crews.repository';
import type {
  CrewCreateInput,
  CrewListQuery,
  CrewUpdateInput,
} from './crews.schema';
import { serializeCrew, type CrewResponse } from './crews.serializer';

/**
 * Crew business logic. A crew always belongs to one organisation; an employee
 * may belong to only one *active* crew so location history can be attributed
 * to a single team at a time.
 */
export class CrewService {
  private readonly repository = new CrewRepository();

  async list(organization: string, query: CrewListQuery): Promise<CrewResponse[]> {
    const rows = await this.repository.findForOrganization(organization, query);
    return rows.map(serializeCrew);
  }

  async get(id: string, organization: string): Promise<CrewResponse> {
    const row = await this.findRow(id, organization);
    return serializeCrew(row);
  }

  async create(input: CrewCreateInput, organization: string): Promise<CrewResponse> {
    const name = input.name.trim();
    if (await this.repository.findByNameInOrganization(name, organization)) {
      throw new AlreadyExistsError('Crew', 'name');
    }

    const code = input.code?.trim() || null;
    if (code && (await this.repository.findByCodeInOrganization(code, organization))) {
      throw new AlreadyExistsError('Crew', 'code');
    }

    const leaderId = input.leaderEmployeeId ?? null;
    const memberIds = this.mergeMembers(input.employeeIds ?? [], leaderId);
    const status = input.status ?? 'active';
    await this.loadEmployees(memberIds, organization);
    if (status === 'active') {
      await this.assertMembersAvailable(organization, memberIds);
    }

    const row = await this.repository.create({
      name,
      code,
      organization,
      leader: leaderId,
      members: memberIds,
      status,
      notes: input.notes ?? null,
    });

    return serializeCrew(row);
  }

  async update(
    id: string,
    input: CrewUpdateInput,
    organization: string,
  ): Promise<CrewResponse> {
    if (Object.keys(input).length === 0) {
      throw new BadRequestError('No fields to update');
    }

    const existing = await this.findRow(id, organization);
    const updates: Record<string, unknown> = {};
    let memberIds = existing.members.map((member) => member.id);
    let memberIdsChanged = false;

    if (input.name !== undefined) {
      const name = input.name.trim();
      const clash = await this.repository.findByNameInOrganization(name, organization);
      if (clash && clash.id !== existing.id) throw new AlreadyExistsError('Crew', 'name');
      updates.name = name;
    }

    if (input.code !== undefined) {
      const code = input.code?.trim() || null;
      if (code) {
        const clash = await this.repository.findByCodeInOrganization(code, organization);
        if (clash && clash.id !== existing.id) throw new AlreadyExistsError('Crew', 'code');
      }
      updates.code = code;
    }

    if (input.employeeIds !== undefined) {
      memberIds = [...new Set(input.employeeIds)];
      memberIdsChanged = true;
    }

    if (input.leaderEmployeeId !== undefined) {
      const leaderId = input.leaderEmployeeId;
      if (leaderId && !memberIds.includes(leaderId)) {
        memberIds = [...memberIds, leaderId];
        memberIdsChanged = true;
      }
      updates.leader = leaderId;
    } else if (memberIdsChanged) {
      updates.leader =
        existing.leaderId && memberIds.includes(existing.leaderId)
          ? existing.leaderId
          : null;
    }

    if (memberIdsChanged) {
      updates.members = memberIds;
    }

    if (input.status !== undefined) updates.status = input.status;
    if (input.notes !== undefined) updates.notes = input.notes;

    const nextStatus = (input.status ?? existing.status) as CrewRow['status'];
    if (memberIdsChanged || nextStatus === 'active') {
      await this.loadEmployees(memberIds, organization);
      if (nextStatus === 'active') {
        await this.assertMembersAvailable(organization, memberIds, existing.id);
      }
    }

    const row = await this.repository.update(existing.id, updates);
    return serializeCrew(row);
  }

  async addMembers(
    id: string,
    employeeIds: string[],
    organization: string,
  ): Promise<CrewResponse> {
    const existing = await this.findRow(id, organization);
    const memberIds = this.mergeMembers(
      existing.members.map((member) => member.id),
      ...employeeIds,
    );

    await this.loadEmployees(employeeIds, organization);
    if (existing.status === 'active') {
      await this.assertMembersAvailable(organization, employeeIds, existing.id);
    }

    const row = await this.repository.update(existing.id, { members: memberIds });
    return serializeCrew(row);
  }

  async removeMember(
    id: string,
    employeeId: string,
    organization: string,
  ): Promise<CrewResponse> {
    const existing = await this.findRow(id, organization);
    if (!existing.members.some((member) => member.id === employeeId)) {
      throw new NotFoundError('Crew member');
    }

    const updates: Record<string, unknown> = {
      members: existing.members
        .map((member) => member.id)
        .filter((memberId) => memberId !== employeeId),
    };
    if (existing.leaderId === employeeId) updates.leader = null;

    const row = await this.repository.update(existing.id, updates);
    return serializeCrew(row);
  }

  /** Archives (soft-deactivates) a crew without destroying historical tracking. */
  async archive(id: string, organization: string): Promise<CrewResponse> {
    const existing = await this.findRow(id, organization);
    const row = await this.repository.update(existing.id, { status: 'inactive' });
    return serializeCrew(row);
  }

  /** Used by tracking when a check-in or ping needs the employee's current crew. */
  async findActiveForEmployee(
    organization: string,
    employeeId: string,
  ): Promise<CrewRow | null> {
    return this.repository.findActiveForEmployee(organization, employeeId);
  }

  private async findRow(id: string, organization: string): Promise<CrewRow> {
    const row = await this.repository.findOneInOrganization(id, organization);
    if (!row) throw new NotFoundError('Crew');
    return row;
  }

  /** Adds a leader to the member list without duplicating existing ids. */
  private mergeMembers(base: string[], ...extra: (string | null | undefined)[]): string[] {
    return [...new Set([...base, ...extra.filter((id): id is string => Boolean(id))])];
  }

  private async loadEmployees(ids: string[], organization: string): Promise<EmployeeRow[]> {
    if (ids.length === 0) return [];

    const rows = await Promise.all(
      ids.map(async (id) => {
        try {
          return await employeesService.findOneInOrganization(id, organization);
        } catch {
          return null;
        }
      }),
    );

    const missing = ids.filter((_, index) => !rows[index]);
    if (missing.length > 0) {
      throw new BadRequestError(`Unknown employee id: ${missing[0]}`);
    }

    return rows.filter((row): row is EmployeeRow => row !== null);
  }

  /**
   * Prevents an employee from being active in two crews. Inactive crews retain
   * their roster but do not block a new active assignment.
   */
  private async assertMembersAvailable(
    organization: string,
    employeeIds: string[],
    excludeCrewId?: string,
  ): Promise<void> {
    if (employeeIds.length === 0) return;

    const activeCrews = await this.repository.findActiveByEmployeeIds(
      organization,
      employeeIds,
    );
    const wanted = new Set(employeeIds);
    const conflict = activeCrews.find(
      (crew) =>
        crew.id !== excludeCrewId &&
        crew.members.some((member) => wanted.has(member.id)),
    );
    if (!conflict) return;

    const employee = conflict.members.find((member) => wanted.has(member.id));
    throw new BadRequestError(
      `${employee?.employeeRef ?? 'Employee'} is already assigned to active crew "${conflict.name}"`,
    );
  }
}

export const crewsService = new CrewService();
