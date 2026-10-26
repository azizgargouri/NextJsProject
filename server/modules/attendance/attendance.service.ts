import { ForbiddenError, NotFoundError } from '../../shared/database/errors';
import type { AccessTokenPayload } from '../../shared/auth/jwt';
import { addDays, startOfDay } from '../../shared/date';
import { employeesService } from '../employees/employees.service';
import { AttendanceRepository, type AttendanceRow } from './attendance.repository';
import type { AttendanceQuery, CheckInInput } from './attendance.schema';
import { serializeAttendance, type AttendanceResponse } from './attendance.serializer';

/** Outcome of a check-in attempt (mirrors the local handler's response flags). */
export interface CheckInResult {
  attendance: AttendanceRow;
  created: boolean;
  alreadyCheckedIn?: boolean;
  updatedLocation?: boolean;
}

interface GeoFix {
  lat: number;
  lng: number;
  accuracy?: number;
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

/**
 * Attendance business logic: org-scoped range reads (admins see their whole
 * directory, everyone else only themselves) and the geolocated check-in flow.
 */
export class AttendanceService {
  private readonly repository = new AttendanceRepository();

  async list(query: AttendanceQuery, user: AccessTokenPayload): Promise<AttendanceResponse[]> {
    const employeeIds = await this.resolveScope(query, user);
    if (employeeIds.length === 0) return [];

    const rows = await this.repository.findRange({
      from: query.from,
      to: query.to,
      employeeIds,
    });
    return rows.map(serializeAttendance);
  }

  /** Check-in (or location refresh) for the profile linked to the session. */
  async checkIn(user: AccessTokenPayload, input: CheckInInput): Promise<CheckInResult> {
    const employee = await employeesService.findMyProfile(user.email);
    if (!employee) throw new NotFoundError('Employee profile');
    if (employee.status !== 'active') {
      throw new ForbiddenError('This account is inactive. Contact HR.');
    }

    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = addDays(dayStart, 1);

    const location: GeoFix | undefined =
      input.latitude !== undefined && input.longitude !== undefined
        ? {
            lat: input.latitude,
            lng: input.longitude,
            ...(input.accuracy !== undefined ? { accuracy: Math.round(input.accuracy) } : {}),
          }
        : undefined;

    const existing = await this.repository.findByDay(employee.id, dayStart, dayEnd);

    if (existing?.clockIn) {
      if (input.updateLocationOnly && location) {
        const attendance = await this.repository.update(existing.id, { location });
        return { attendance, created: false, updatedLocation: true };
      }
      return { attendance: existing, created: false, alreadyCheckedIn: true };
    }

    const fields: Record<string, unknown> = {
      clockIn: now,
      status: 'present',
      ...(location ? { location } : {}),
    };

    try {
      const attendance = existing
        ? await this.repository.update(existing.id, fields)
        : await this.repository.create({ employee: employee.id, workDate: dayStart, ...fields });
      return { attendance, created: !existing };
    } catch (error) {
      // Two requests raced for the same day (unique index) — return the stored record.
      if (isDuplicateKey(error)) {
        const raced = await this.repository.findByDay(employee.id, dayStart, dayEnd);
        if (raced) {
          return { attendance: raced, created: false, alreadyCheckedIn: Boolean(raced.clockIn) };
        }
      }
      throw error;
    }
  }

  /**
   * Resolves which employees the caller may read: admins get their whole
   * organisation (optionally narrowed to one ref), everyone else gets only
   * their own profile.
   */
  private async resolveScope(query: AttendanceQuery, user: AccessTokenPayload): Promise<string[]> {
    return employeesService.resolveReadScope(user, query.employeeRef);
  }
}

export const attendanceService = new AttendanceService();
