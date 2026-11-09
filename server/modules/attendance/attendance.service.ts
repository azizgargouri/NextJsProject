import { ForbiddenError, NotFoundError } from '../../shared/database/errors';
import type { AccessTokenPayload } from '../../shared/auth/jwt';
import { addDays, startOfDay } from '../../shared/date';
import { employeesService } from '../employees/employees.service';
import { trackingService } from '../tracking/tracking.service';
import type { TrackingSessionResponse } from '../tracking/tracking.serializer';
import { AttendanceRepository, type AttendanceRow } from './attendance.repository';
import type { AttendanceQuery, CheckInInput } from './attendance.schema';
import { serializeAttendance, type AttendanceResponse } from './attendance.serializer';

/** Outcome of a check-in attempt (mirrors the local handler's response flags). */
export interface CheckInResult {
  attendance: AttendanceRow;
  created: boolean;
  alreadyCheckedIn?: boolean;
  tracking: TrackingSessionResponse;
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

  /**
   * Check-in for the profile linked to the session. The button is always
   * available, so every call appends a punch (timestamp + optional geo fix);
   * the first punch of the day becomes `clockIn`.
   */
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

    // Append-only punch log: each press keeps its own timestamp + location so HR
    // can see every registration, not just the first one of the day.
    const punch = { at: now, location: location ?? null };

    const fields: Record<string, unknown> = {
      punches: [...(existing?.punches ?? []), punch],
      ...(location ? { location } : {}),
    };

    if (!existing?.clockIn) {
      Object.assign(fields, { clockIn: now, status: 'present' });
    }

    try {
      const attendance = existing
        ? await this.repository.update(existing.id, fields)
        : await this.repository.create({ employee: employee.id, workDate: dayStart, ...fields });
      const tracking = await trackingService.startForCheckIn({
        organization: employee.organization ?? user.sub,
        employeeId: employee.id,
        attendanceId: attendance.id,
        at: now,
        location: location ?? null,
      });
      return {
        attendance,
        created: !existing,
        ...(existing?.clockIn ? { alreadyCheckedIn: true } : {}),
        tracking,
      };
    } catch (error) {
      // Two requests raced for the same day (unique index) — register on the stored row.
      if (isDuplicateKey(error)) {
        const raced = await this.repository.findByDay(employee.id, dayStart, dayEnd);
        if (raced) {
          const attendance = await this.repository.update(raced.id, fields);
          const tracking = await trackingService.startForCheckIn({
            organization: employee.organization ?? user.sub,
            employeeId: employee.id,
            attendanceId: attendance.id,
            at: now,
            location: location ?? null,
          });
          return {
            attendance,
            created: false,
            alreadyCheckedIn: Boolean(raced.clockIn),
            tracking,
          };
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
