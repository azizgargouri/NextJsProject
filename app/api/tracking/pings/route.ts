import { trackingController } from '@/server/modules/tracking/tracking.controller';
import type { NextRequest } from 'next/server';

/** POST /api/tracking/pings — employee geolocation sample (every 5 minutes). */
export async function POST(request: NextRequest) {
  return trackingController.ping(request);
}
