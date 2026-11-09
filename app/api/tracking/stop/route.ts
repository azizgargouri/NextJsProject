import { trackingController } from '@/server/modules/tracking/tracking.controller';
import type { NextRequest } from 'next/server';

/** POST /api/tracking/stop — end the active tracking session. */
export async function POST(request: NextRequest) {
  return trackingController.stop(request);
}
