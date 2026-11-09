'use server';

import type {
  AttendanceDto,
  CheckInResponse,
  CrewDto,
  EmployeeDto,
  LeaveRequestDto,
} from '@/types';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import { requireActionUser, parseActionPayload, runAction } from '@/server/actions/helpers';
import { employeesService } from '@/server/modules/employees/employees.service';
import {
  EmployeeCreateSchema,
  EmployeeUpdateSchema,
} from '@/server/modules/employees/employees.schema';
import { attendanceService } from '@/server/modules/attendance/attendance.service';
import { CheckInSchema } from '@/server/modules/attendance/attendance.schema';
import { serializeAttendance } from '@/server/modules/attendance/attendance.serializer';
import { leaveRequestsService } from '@/server/modules/leave-requests/leave-requests.service';
import {
  LeaveCreateSchema,
  LeaveDecisionSchema,
} from '@/server/modules/leave-requests/leave-requests.schema';
import { crewsService } from '@/server/modules/crews/crews.service';
import {
  CrewCreateSchema,
  CrewMembersSchema,
  CrewUpdateSchema,
} from '@/server/modules/crews/crews.schema';
import type { ActionResult } from '@/lib/actions/result';

/* --- Employees (HR directory) --- */

export async function createEmployeeAction(
  accessToken: string | null | undefined,
  payload: unknown,
): Promise<ActionResult<EmployeeDto>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken, { admin: true });
    const input = parseActionPayload(EmployeeCreateSchema, payload);
    const employee = await employeesService.createEmployee(input, user.sub);

    logEvent({
      event: EventType.EMPLOYEE_CREATE,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: 'action:employees.create',
      logInfo: { employeeRef: employee.employeeRef },
    });

    return employee;
  });
}

export async function updateEmployeeAction(
  accessToken: string | null | undefined,
  id: string,
  payload: unknown,
): Promise<ActionResult<EmployeeDto>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken, { admin: true });
    const input = parseActionPayload(EmployeeUpdateSchema, payload);
    const employee = await employeesService.updateEmployee(id, input, user.sub);

    logEvent({
      event: EventType.EMPLOYEE_UPDATE,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: `action:employees.update`,
      logInfo: { employeeId: employee.id, employeeRef: employee.employeeRef },
    });

    return employee;
  });
}

/* --- Attendance / check-in --- */

export async function checkInAction(
  accessToken: string | null | undefined,
  payload: unknown,
): Promise<ActionResult<CheckInResponse>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken);
    const input = parseActionPayload(CheckInSchema, payload);
    const result = await attendanceService.checkIn(user, input);

    logEvent({
      event: EventType.ATTENDANCE_CHECKIN,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: 'action:attendance.checkin',
    });

    return {
      success: true,
      ...(result.alreadyCheckedIn ? { alreadyCheckedIn: true } : {}),
      attendance: serializeAttendance(result.attendance) as AttendanceDto,
      tracking: result.tracking,
    };
  });
}

/* --- Leave requests --- */

export async function createLeaveRequestAction(
  accessToken: string | null | undefined,
  payload: unknown,
): Promise<ActionResult<LeaveRequestDto>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken);
    const input = parseActionPayload(LeaveCreateSchema, payload);
    const leaveRequest = await leaveRequestsService.create(user, input);

    logEvent({
      event: EventType.LEAVE_CREATE,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: 'action:leave-requests.create',
      logInfo: { type: leaveRequest.type },
    });

    return leaveRequest;
  });
}

export async function decideLeaveRequestAction(
  accessToken: string | null | undefined,
  id: string,
  payload: unknown,
): Promise<ActionResult<LeaveRequestDto>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken, { admin: true });
    const { status } = parseActionPayload(LeaveDecisionSchema, payload);
    const leaveRequest = await leaveRequestsService.decide(id, status, user);

    logEvent({
      event: EventType.LEAVE_DECIDE,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: 'action:leave-requests.decide',
      logInfo: { leaveRequestId: leaveRequest.id, status },
    });

    return leaveRequest;
  });
}

/* --- Crews --- */

export async function createCrewAction(
  accessToken: string | null | undefined,
  payload: unknown,
): Promise<ActionResult<CrewDto>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken, { admin: true });
    const input = parseActionPayload(CrewCreateSchema, payload);
    const crew = await crewsService.create(input, user.sub);

    logEvent({
      event: EventType.CREW_CREATE,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: 'action:crews.create',
      logInfo: { crewId: crew.id },
    });

    return crew;
  });
}

export async function updateCrewAction(
  accessToken: string | null | undefined,
  id: string,
  payload: unknown,
): Promise<ActionResult<CrewDto>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken, { admin: true });
    const input = parseActionPayload(CrewUpdateSchema, payload);
    const crew = await crewsService.update(id, input, user.sub);

    logEvent({
      event: EventType.CREW_UPDATE,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: 'action:crews.update',
      logInfo: { crewId: crew.id },
    });

    return crew;
  });
}

export async function archiveCrewAction(
  accessToken: string | null | undefined,
  id: string,
): Promise<ActionResult<CrewDto>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken, { admin: true });
    const crew = await crewsService.archive(id, user.sub);

    logEvent({
      event: EventType.CREW_UPDATE,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: 'action:crews.archive',
      logInfo: { crewId: crew.id, archived: true },
    });

    return crew;
  });
}

export async function addCrewMembersAction(
  accessToken: string | null | undefined,
  id: string,
  payload: unknown,
): Promise<ActionResult<CrewDto>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken, { admin: true });
    const { employeeIds } = parseActionPayload(CrewMembersSchema, payload);
    const crew = await crewsService.addMembers(id, employeeIds, user.sub);

    logEvent({
      event: EventType.CREW_MEMBER_ADD,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: 'action:crews.add-members',
      logInfo: { crewId: crew.id, employeeIds },
    });

    return crew;
  });
}

export async function removeCrewMemberAction(
  accessToken: string | null | undefined,
  id: string,
  employeeId: string,
): Promise<ActionResult<CrewDto>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken, { admin: true });
    const crew = await crewsService.removeMember(id, employeeId, user.sub);

    logEvent({
      event: EventType.CREW_MEMBER_REMOVE,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: 'action:crews.remove-member',
      logInfo: { crewId: crew.id, employeeId },
    });

    return crew;
  });
}
