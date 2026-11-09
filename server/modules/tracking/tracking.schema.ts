import { z } from 'zod';
import { BadRequestError } from '../../shared/database/errors';
import { addDays, parseDay, startOfDay } from '../../shared/date';
import {
  TRACKING_HEATMAP_DEFAULT_CELL_METERS,
  TRACKING_HISTORY_MAX_DAYS,
} from '../../shared/tracking';

/** Browser geolocation sample posted every five minutes while checked in. */
export const TrackingPingSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).max(100_000).optional(),
});

export type TrackingPingInput = z.infer<typeof TrackingPingSchema>;

export interface TrackingHistoryQuery {
  employeeRef: string;
  /** Inclusive local start of the range. */
  from: Date;
  /** Exclusive local end of the range. */
  to: Date;
  cellMeters: number;
  maxAccuracyM?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseNumber(
  value: string | null,
  fallback: number | undefined,
  min: number,
  max: number,
  label: string,
): number | undefined {
  if (value === null || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new BadRequestError(`${label} must be between ${min} and ${max}`);
  }
  return parsed;
}

/**
 * Parses the HR history query. `date` selects one day; `from`/`to` select an
 * inclusive range. `to` is converted to an exclusive next-day boundary.
 */
export function parseTrackingHistoryQuery(
  searchParams: URLSearchParams,
): TrackingHistoryQuery {
  const employeeRef = searchParams.get('employeeRef')?.trim();
  if (!employeeRef) throw new BadRequestError('employeeRef is required');

  const dateParam = searchParams.get('date');
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  let from: Date;
  let to: Date;

  if (fromParam || toParam) {
    const start = parseDay(fromParam ?? toParam!);
    const end = parseDay(toParam ?? fromParam!);
    if (!start || !end) throw new BadRequestError('Invalid date range');

    from = startOfDay(start);
    to = addDays(startOfDay(end), 1);
    if (to <= from) throw new BadRequestError('Invalid date range');
  } else {
    const base = dateParam ? parseDay(dateParam) : new Date();
    if (!base) throw new BadRequestError('Invalid date');

    from = startOfDay(base);
    to = addDays(from, 1);
  }

  const days = (to.getTime() - from.getTime()) / DAY_MS;
  if (days > TRACKING_HISTORY_MAX_DAYS) {
    throw new BadRequestError(
      `History range cannot exceed ${TRACKING_HISTORY_MAX_DAYS} days`,
    );
  }

  const cellMeters =
    parseNumber(
      searchParams.get('cellMeters'),
      TRACKING_HEATMAP_DEFAULT_CELL_METERS,
      10,
      500,
      'cellMeters',
    ) ?? TRACKING_HEATMAP_DEFAULT_CELL_METERS;
  const maxAccuracyM = parseNumber(
    searchParams.get('maxAccuracyM'),
    undefined,
    0,
    100_000,
    'maxAccuracyM',
  );

  return {
    employeeRef,
    from,
    to,
    cellMeters: Math.round(cellMeters),
    ...(maxAccuracyM !== undefined ? { maxAccuracyM } : {}),
  };
}
