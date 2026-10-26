import { reportsController } from '@/server/modules/reports/reports.controller';
import type { NextRequest } from 'next/server';

/** GET /api/reports/dashboard — HR overview numbers for the signed-in admin. */
export async function GET(request: NextRequest) {
  return reportsController.dashboardStats(request);
}
