import { trackingController } from '@/server/modules/tracking/tracking.controller';
import type { NextRequest } from 'next/server';

/** GET /api/tracking/session — the signed-in employee's active session. */
export async function GET(request: NextRequest) {
  return trackingController.session(request);
}
