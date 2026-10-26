import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '../../shared/auth/guards';
import { BadRequestError } from '../../shared/database/errors';
import { parseDay } from '../../shared/date';
import { EMPLOYEE_STATUSES } from '../../shared/database/enums';
import { reportsService } from './reports.service';

/**
 * Reports controller — GET /api/reports/dashboard returns the HR overview
 * numbers (optionally narrowed by an inclusive date range and status).
 */
class ReportsController {
  async dashboardStats(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAdmin(request);

      const params = request.nextUrl.searchParams;
      const fromParam = params.get('from');
      const toParam = params.get('to');
      const statusParam = params.get('status');

      const dateFrom = fromParam ? parseDay(fromParam) : undefined;
      const dateTo = toParam ? parseDay(toParam) : undefined;
      if ((fromParam && !dateFrom) || (toParam && !dateTo)) {
        throw new BadRequestError('Invalid date range');
      }

      if (statusParam && !EMPLOYEE_STATUSES.includes(statusParam as 'active')) {
        throw new BadRequestError('Invalid status filter');
      }

      const stats = await reportsService.getDashboardStats({
        organization: user.sub,
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(statusParam ? { status: statusParam } : {}),
      });

      return NextResponse.json({ stats });
    } catch (error) {
      return errorResponse(error);
    }
  }
}

export const reportsController = new ReportsController();
