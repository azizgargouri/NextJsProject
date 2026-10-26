import type { LeaveStatus, LeaveType } from '../../shared/database/enums';

/** Whitelisted leave-request response. */
export interface LeaveRequestResponse {
  id: string;
  employee: { id: string; employeeRef: string; fullName: string } | null;
  type: LeaveType;
  startDate: string;
  endDate: string;
  daysRequested: number;
  status: LeaveStatus;
  reason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Maps a leave-request row to the whitelisted response DTO. */
export function serializeLeaveRequest(row: {
  id: string;
  employee: { id: string; employeeRef: string; fullName: string } | null;
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
}): LeaveRequestResponse {
  return {
    id: row.id,
    employee: row.employee,
    type: row.type,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    daysRequested: row.daysRequested,
    status: row.status,
    reason: row.reason,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
