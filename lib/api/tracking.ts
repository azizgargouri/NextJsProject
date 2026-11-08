import {
  recordTrackingPingAction,
  stopTrackingAction,
} from '@/app/actions/tracking';
import { actionAccessToken, unwrapActionResult } from '@/lib/actions/client';
import { axiosClient } from './client';
import type {
  TrackingHistoryDto,
  TrackingPingPayload,
  TrackingPingResult,
  TrackingSessionDto,
  TrackingStopResult,
} from '@/types';

export interface TrackingHistoryParams {
  employeeRef: string;
  /** Single day (`YYYY-MM-DD`) or an inclusive from/to range. */
  date?: string;
  from?: string;
  to?: string;
  /** Heatmap cell side in metres (server default 50). */
  cellMeters?: number;
  /** Drop samples worse than this accuracy when building the heatmap. */
  maxAccuracyM?: number;
}

/** Employee tracking pings plus HR history/heatmap reads. */
export const trackingApi = {
  ping: async (payload: TrackingPingPayload): Promise<TrackingPingResult> =>
    unwrapActionResult(await recordTrackingPingAction(actionAccessToken(), payload)),
  session: async (): Promise<TrackingSessionDto | null> => {
    const { data } = await axiosClient.get<{
      session: TrackingSessionDto | null;
    }>('/api/tracking/session');
    return data.session;
  },
  stop: async (): Promise<TrackingStopResult> =>
    unwrapActionResult(await stopTrackingAction(actionAccessToken())),
  history: async (params: TrackingHistoryParams): Promise<TrackingHistoryDto> => {
    const { data } = await axiosClient.get<{ history: TrackingHistoryDto }>(
      '/api/tracking/history',
      { params },
    );
    return data.history;
  },
};
