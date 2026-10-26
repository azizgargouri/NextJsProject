import { z } from 'zod';
import { BadRequestError } from '../../shared/database/errors';
import { addDays, parseDay, startOfDay } from '../../shared/date';
import { ATTENDANCE_STATUSES } from '../../shared/database/enums';

/** Browser geolocation payload posted by the check-in card. */
export const CheckInSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  accuracy: z.coerce.number().min(0).optional(),
  updateLocationOnly: z.boolean().default(false),
});

export type CheckInInput = z.infer<typeof CheckInSchema>;

export const AttendanceStatusSchema = z.enum(ATTENDANCE_STATUSES);

/** Resolved list query: an inclusive start and an exclusive end (local midnight + 1 day). */
export interface AttendanceQuery {
  from: Date;
  to: Date;
  employeeRef?: string;
}

/**
 * Parses `date` / `from` / `to` / `employeeRef` exactly like the local module's
 * handler: a single `date` collapses to one day, `from`+`to` span a range,
 * and the default window is today.
 */
export function parseAttendanceQuery(searchParams: URLSearchParams): AttendanceQuery {
  const dateParam = searchParams.get('date');
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const employeeRef = searchParams.get('employeeRef')?.trim() || undefined;

  let from: Date;
  let to: Date;

  if (fromParam || toParam) {
    const start = parseDay(fromParam ?? toParam!);
    const end = parseDay(toParam ?? fromParam!);
    if (!start || !end) throw new BadRequestError('Invalid date range');

    from = startOfDay(start);
    to = startOfDay(end);
    to = addDays(to, 1);
    if (to <= from) throw new BadRequestError('Invalid date range');
  } else {
    const base = dateParam ? parseDay(dateParam) : new Date();
    if (!base) throw new BadRequestError('Invalid date');

    from = startOfDay(base);
    to = addDays(from, 1);
  }

  return employeeRef ? { from, to, employeeRef } : { from, to };
}
