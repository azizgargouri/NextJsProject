import { NotFoundError } from '../../shared/database/errors';
import type { AccessTokenPayload } from '../../shared/auth/jwt';
import { employeesService } from '../employees/employees.service';
import { LeaveRequestRepository, type LeaveRequestRow } from './leave-requests.repository';
import type { LeaveCreateInput, LeaveQuery } from './leave-requests.schema';
import { serializeLeaveRequest, type LeaveRequestResponse } from './leave-requests.serializer';

const MS_PER_DAY = 86_400_000;

/** Calendar days covered by an inclusive [start, end] range. */
function daysBetween(start: Date, end: Date): number {
  const startDay = new Date(start).setHours(0, 0, 0, 0);
  const endDay = new Date(end).setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((endDay - startDay) / MS_PER_DAY) + 1);
}

/**
 * Leave business logic: submissions come from the session's own employee
 * profile, decisions are organisation-scoped HR work (admins only).
 */
export class LeaveRequestService {
  private readonly repository = new LeaveRequestRepository();

  async list(query: LeaveQuery, user: AccessTokenPayload): Promise<LeaveRequestResponse[]> {
    const employeeIds = await employeesService.resolveReadScope(user, query.employeeRef);
    const rows = await this.repository.findScoped({
      employeeIds,
      ...(query.status ? { status: query.status } : {}),
    });
    return rows.map(serializeLeaveRequest);
  }

  async create(user: AccessTokenPayload, input: LeaveCreateInput): Promise<LeaveRequestResponse> {
    const employee = await employeesService.findMyProfile(user.email);
    if (!employee) throw new NotFoundError('Employee profile');

    const row = await this.repository.create({
      employee: employee.id,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      daysRequested: input.daysRequested ?? daysBetween(input.startDate, input.endDate),
      reason: input.reason ?? null,
      status: 'pending',
    });

    return serializeLeaveRequest(row);
  }

  /** Approves or rejects a request belonging to the caller's organisation. */
  async decide(
    id: string,
    status: 'approved' | 'rejected',
    user: AccessTokenPayload,
  ): Promise<LeaveRequestResponse> {
    const existing = await this.repository.findOneById(id);
    if (!existing) throw new NotFoundError('Leave request');

    // Throws NotFound / Forbidden unless the request's employee is in scope.
    await employeesService.findOneInOrganization(existing.employeeId, user.sub);

    const updated = await this.repository.update(id, {
      status,
      approvedBy: user.sub,
      approvedAt: new Date(),
    });

    return serializeLeaveRequest(updated);
  }
}

export const leaveRequestsService = new LeaveRequestService();
