import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAuth } from '../../shared/auth/guards';
import { logEvent, EventType } from '../../shared/logger/audit';
import { parseJsonBody } from '../../shared/validation';
import { attendanceService } from './attendance.service';
import { CheckInSchema, parseAttendanceQuery } from './attendance.schema';
import { serializeAttendance } from './attendance.serializer';

/**
 * Attendance controller — thin HTTP adapter: parse/validate, call the service,
 * serialize, map errors to HTTP. Reads are JWT-scoped (admin → organisation,
 * everyone else → self).
 */
class AttendanceController {
  /** GET /api/attendance?date=|from=&to=&employeeRef= */
  async list(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAuth(request);
      const query = parseAttendanceQuery(request.nextUrl.searchParams);
      const attendance = await attendanceService.list(query, user);

      return NextResponse.json({
        date: query.from,
        from: query.from,
        to: query.to,
        attendance,
      });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** POST /api/attendance/checkin — geolocated check-in for the session's profile. */
  async checkIn(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAuth(request);
      const input = await parseJsonBody(request, CheckInSchema);
      const result = await attendanceService.checkIn(user, input);

      logEvent({
        event: EventType.ATTENDANCE_CHECKIN,
        userId: user.sub,
        method: 'POST',
        api: '/api/attendance/checkin',
      });

      return NextResponse.json(
        {
          success: true,
          ...(result.alreadyCheckedIn ? { alreadyCheckedIn: true } : {}),
          ...(result.updatedLocation ? { updatedLocation: true } : {}),
          attendance: serializeAttendance(result.attendance),
        },
        { status: result.created ? 201 : 200 },
      );
    } catch (error) {
      return errorResponse(error);
    }
  }
}

export const attendanceController = new AttendanceController();
