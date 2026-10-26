import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin, requireAuth } from '../../shared/auth/guards';
import { logEvent, EventType } from '../../shared/logger/audit';
import { parseJsonBody } from '../../shared/validation';
import { leaveRequestsService } from './leave-requests.service';
import { LeaveCreateSchema, LeaveDecisionSchema, parseLeaveQuery } from './leave-requests.schema';

/**
 * Leave-request controller — thin HTTP adapter: parse/validate, call the
 * service, serialize, map errors to HTTP.
 */
class LeaveRequestsController {
  /** GET /api/leave-requests?status=&employeeRef= */
  async list(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAuth(request);
      const query = parseLeaveQuery(request.nextUrl.searchParams);
      const leaveRequests = await leaveRequestsService.list(query, user);
      return NextResponse.json({ leaveRequests });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** POST /api/leave-requests — submit a request for the session's profile. */
  async create(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAuth(request);
      const input = await parseJsonBody(request, LeaveCreateSchema);
      const leaveRequest = await leaveRequestsService.create(user, input);

      logEvent({
        event: EventType.LEAVE_CREATE,
        userId: user.sub,
        method: 'POST',
        api: '/api/leave-requests',
        logInfo: { type: leaveRequest.type },
      });

      return NextResponse.json({ leaveRequest }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** PATCH /api/leave-requests/[id] — HR approve / reject (admins only). */
  async decide(request: NextRequest, id: string): Promise<NextResponse> {
    try {
      const user = await requireAdmin(request);
      const { status } = await parseJsonBody(request, LeaveDecisionSchema);
      const leaveRequest = await leaveRequestsService.decide(id, status, user);

      logEvent({
        event: EventType.LEAVE_DECIDE,
        userId: user.sub,
        method: 'PATCH',
        api: `/api/leave-requests/${id}`,
        logInfo: { status },
      });

      return NextResponse.json({ leaveRequest });
    } catch (error) {
      return errorResponse(error);
    }
  }
}

export const leaveRequestsController = new LeaveRequestsController();
