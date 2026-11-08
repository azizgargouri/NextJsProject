'use server';

import type { TrackingPingResult, TrackingStopResult } from '@/types';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import { requireActionUser, parseActionPayload, runAction } from '@/server/actions/helpers';
import { trackingService } from '@/server/modules/tracking/tracking.service';
import { TrackingPingSchema } from '@/server/modules/tracking/tracking.schema';
import type { ActionResult } from '@/lib/actions/result';

/** Persists one browser geolocation sample for the signed-in employee. */
export async function recordTrackingPingAction(
  accessToken: string | null | undefined,
  payload: unknown,
): Promise<ActionResult<TrackingPingResult>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken);
    const input = parseActionPayload(TrackingPingSchema, payload);
    const result = await trackingService.recordPing(user, input);

    if (result.accepted) {
      logEvent({
        event: EventType.TRACKING_PING,
        userId: user.sub,
        method: 'SERVER_ACTION',
        api: 'action:tracking.ping',
        logInfo: { sessionId: result.session.id },
      });
    }

    return result;
  });
}

/** Ends the signed-in employee's active tracking session. */
export async function stopTrackingAction(
  accessToken: string | null | undefined,
): Promise<ActionResult<TrackingStopResult>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken);
    const result = await trackingService.stop(user);

    if (result.stopped) {
      logEvent({
        event: EventType.TRACKING_STOP,
        userId: user.sub,
        method: 'SERVER_ACTION',
        api: 'action:tracking.stop',
        logInfo: { sessionId: result.session?.id },
      });
    }

    return result;
  });
}
