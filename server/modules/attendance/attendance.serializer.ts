import type { AttendanceStatus } from '../../shared/database/enums';
import type {
  AttendanceLocation,
  AttendancePunch,
} from '../../shared/database/models/attendance.model';

/** A single registration, serialized for the client. */
export interface AttendancePunchResponse {
  at: string;
  location: AttendanceLocation | null;
}

/** Whitelisted attendance response (employee embedded as a compact reference). */
export interface AttendanceResponse {
  id: string;
  employee: { id: string; employeeRef: string; fullName: string } | null;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  status: AttendanceStatus;
  breakDuration: number;
  location: AttendanceLocation | null;
  punches: AttendancePunchResponse[];
  createdAt: string;
  updatedAt: string;
}

/** Maps an attendance row to the whitelisted response DTO. */
export function serializeAttendance(row: {
  id: string;
  employee: { id: string; employeeRef: string; fullName: string } | null;
  workDate: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  status: AttendanceStatus;
  breakDuration: number;
  location: AttendanceLocation | null;
  punches?: AttendancePunch[];
  createdAt: Date;
  updatedAt: Date;
}): AttendanceResponse {
  return {
    id: row.id,
    employee: row.employee,
    workDate: row.workDate.toISOString(),
    clockIn: row.clockIn ? row.clockIn.toISOString() : null,
    clockOut: row.clockOut ? row.clockOut.toISOString() : null,
    status: row.status,
    breakDuration: row.breakDuration,
    location: row.location,
    punches: (row.punches ?? []).map((punch) => ({
      at: punch.at.toISOString(),
      location: punch.location ?? null,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
