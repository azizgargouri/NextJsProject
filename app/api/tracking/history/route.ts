import { trackingController } from '@/server/modules/tracking/tracking.controller';
import type { NextRequest } from 'next/server';

/**
 * GET /api/tracking/history?employeeRef=EMP001&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Optional: cellMeters (10–500, default 50), maxAccuracyM.
 */
export async function GET(request: NextRequest) {
  return trackingController.history(request);
}
