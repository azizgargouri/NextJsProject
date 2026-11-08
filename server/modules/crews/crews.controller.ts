import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '../../shared/auth/guards';
import { logEvent, EventType } from '../../shared/logger/audit';
import { parseJsonBody } from '../../shared/validation';
import { crewsService } from './crews.service';
import {
  CrewCreateSchema,
  CrewMembersSchema,
  CrewUpdateSchema,
  parseCrewListQuery,
} from './crews.schema';

/**
 * Crew controller — thin HTTP adapter for the HR crew builder. Every route is
 * admin-only and scoped to the authenticated admin's organisation.
 */
class CrewsController {
  /** GET /api/crews?status=&search= */
  async list(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAdmin(request);
      const query = parseCrewListQuery(request.nextUrl.searchParams);
      const crews = await crewsService.list(user.sub, query);
      return NextResponse.json({ crews });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** GET /api/crews/:id */
  async get(request: NextRequest, id: string): Promise<NextResponse> {
    try {
      const user = await requireAdmin(request);
      const crew = await crewsService.get(id, user.sub);
      return NextResponse.json({ crew });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** POST /api/crews */
  async create(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAdmin(request);
      const input = await parseJsonBody(request, CrewCreateSchema);
      const crew = await crewsService.create(input, user.sub);

      logEvent({
        event: EventType.CREW_CREATE,
        userId: user.sub,
        method: 'POST',
        api: '/api/crews',
        logInfo: { crewId: crew.id },
      });

      return NextResponse.json({ crew }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** PATCH /api/crews/:id */
  async update(request: NextRequest, id: string): Promise<NextResponse> {
    try {
      const user = await requireAdmin(request);
      const input = await parseJsonBody(request, CrewUpdateSchema);
      const crew = await crewsService.update(id, input, user.sub);

      logEvent({
        event: EventType.CREW_UPDATE,
        userId: user.sub,
        method: 'PATCH',
        api: `/api/crews/${id}`,
        logInfo: { crewId: crew.id },
      });

      return NextResponse.json({ crew });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** DELETE /api/crews/:id — archives the crew (keeps tracking history). */
  async archive(request: NextRequest, id: string): Promise<NextResponse> {
    try {
      const user = await requireAdmin(request);
      const crew = await crewsService.archive(id, user.sub);

      logEvent({
        event: EventType.CREW_UPDATE,
        userId: user.sub,
        method: 'DELETE',
        api: `/api/crews/${id}`,
        logInfo: { crewId: crew.id, archived: true },
      });

      return NextResponse.json({ crew });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** POST /api/crews/:id/members — add one or more employees. */
  async addMembers(request: NextRequest, id: string): Promise<NextResponse> {
    try {
      const user = await requireAdmin(request);
      const input = await parseJsonBody(request, CrewMembersSchema);
      const crew = await crewsService.addMembers(id, input.employeeIds, user.sub);

      logEvent({
        event: EventType.CREW_MEMBER_ADD,
        userId: user.sub,
        method: 'POST',
        api: `/api/crews/${id}/members`,
        logInfo: { crewId: crew.id, employeeIds: input.employeeIds },
      });

      return NextResponse.json({ crew });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** DELETE /api/crews/:id/members/:employeeId */
  async removeMember(
    request: NextRequest,
    id: string,
    employeeId: string,
  ): Promise<NextResponse> {
    try {
      const user = await requireAdmin(request);
      const crew = await crewsService.removeMember(id, employeeId, user.sub);

      logEvent({
        event: EventType.CREW_MEMBER_REMOVE,
        userId: user.sub,
        method: 'DELETE',
        api: `/api/crews/${id}/members/${employeeId}`,
        logInfo: { crewId: crew.id, employeeId },
      });

      return NextResponse.json({ crew });
    } catch (error) {
      return errorResponse(error);
    }
  }
}

export const crewsController = new CrewsController();
