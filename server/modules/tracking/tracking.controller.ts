import { NextRequest, NextResponse } from 'next/server';
import {
  errorResponse,
  requireAdmin,
  requireAuth,
} from '../../shared/auth/guards';
import { logEvent, EventType } from '../../shared/logger/audit';
import { parseJsonBody } from '../../shared/validation';
import { trackingService } from './tracking.service';
import {
  TrackingPingSchema,
  parseTrackingHistoryQuery,
} from './tracking.schema';

/**
 * Tracking controller — employees post their own pings; HR reads organisation-
 * scoped history. Check-in itself opens the session in the attendance module.
 */
class TrackingController {
  /** POST /api/tracking/pings — one geolocation sample. */
  async ping(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAuth(request);
      const input = await parseJsonBody(request, TrackingPingSchema);
      const result = await trackingService.recordPing(user, input);

      if (result.accepted) {
        logEvent({
          event: EventType.TRACKING_PING,
          userId: user.sub,
          method: 'POST',
          api: '/api/tracking/pings',
          logInfo: { sessionId: result.session.id },
        });
      }

      return NextResponse.json(result, {
        status: result.accepted ? 201 : 200,
      });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** GET /api/tracking/session — current employee tracking state. */
  async session(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAuth(request);
      const session = await trackingService.getActive(user);
      return NextResponse.json({ session });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** POST /api/tracking/stop — end the current session. */
  async stop(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAuth(request);
      const result = await trackingService.stop(user);

      if (result.stopped) {
        logEvent({
          event: EventType.TRACKING_STOP,
          userId: user.sub,
          method: 'POST',
          api: '/api/tracking/stop',
          logInfo: { sessionId: result.session?.id },
        });
      }

      return NextResponse.json(result);
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** GET /api/tracking/history?employeeRef=&from=&to=&cellMeters=&maxAccuracyM= */
  async history(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAdmin(request);
      const query = parseTrackingHistoryQuery(request.nextUrl.searchParams);
      const history = await trackingService.history(user, query);
      return NextResponse.json({ history });
    } catch (error) {
      return errorResponse(error);
    }
  }
}

export const trackingController = new TrackingController();
