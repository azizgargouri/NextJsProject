import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin, requireAuth } from '../../shared/auth/guards';
import { logEvent, EventType } from '../../shared/logger/audit';
import { parseJsonBody } from '../../shared/validation';
import { employeesService } from './employees.service';
import { EmployeeCreateSchema, EmployeeUpdateSchema } from './employees.schema';

/**
 * Employees controller — thin HTTP adapter: parse/validate (Zod), call the
 * service, serialize the response, map errors to HTTP. Every route is guarded
 * by the platform JWT (the local module's `requestedBy` handshake is gone).
 */
class EmployeesController {
  /** GET /api/employees — the caller's organisation directory (admins only). */
  async list(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAdmin(request);
      const myProfile = await employeesService.findMyProfile(user.email);
      const employees = await employeesService.listForOrganization(user.sub, myProfile?.id);
      return NextResponse.json({ employees });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** GET /api/employees/me — the employee profile linked to the session (or null). */
  async me(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAuth(request);
      const employee = await employeesService.findMyProfile(user.email);
      return NextResponse.json({ employee });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** POST /api/employees — add a staff member to the caller's organisation. */
  async create(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAdmin(request);
      const input = await parseJsonBody(request, EmployeeCreateSchema);
      const employee = await employeesService.createEmployee(input, user.sub);

      logEvent({
        event: EventType.EMPLOYEE_CREATE,
        userId: user.sub,
        method: 'POST',
        api: '/api/employees',
        logInfo: { employeeRef: employee.employeeRef },
      });

      return NextResponse.json({ employee }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** PATCH /api/employees/[id] — edit name / email / role / status in-organisation. */
  async update(request: NextRequest, id: string): Promise<NextResponse> {
    try {
      const user = await requireAdmin(request);
      const input = await parseJsonBody(request, EmployeeUpdateSchema);
      const employee = await employeesService.updateEmployee(id, input, user.sub);

      logEvent({
        event: EventType.EMPLOYEE_UPDATE,
        userId: user.sub,
        method: 'PATCH',
        api: `/api/employees/${id}`,
        logInfo: { employeeRef: employee.employeeRef },
      });

      return NextResponse.json({ employee });
    } catch (error) {
      return errorResponse(error);
    }
  }
}

export const employeesController = new EmployeesController();
