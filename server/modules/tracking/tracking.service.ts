import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/database/errors';
import type { AccessTokenPayload } from '../../shared/auth/jwt';
import { addDays, startOfDay, toIsoDate } from '../../shared/date';
import {
  TRACKING_INTERVAL_MINUTES,
  TRACKING_PING_TOLERANCE_SECONDS,
} from '../../shared/tracking';
import { employeesService } from '../employees/employees.service';
import { crewsService } from '../crews/crews.service';
import {
  TrackingRepository,
  type LocationPingRow,
  type TrackingSessionRow,
} from './tracking.repository';
import type {
  TrackingHistoryQuery,
  TrackingPingInput,
} from './tracking.schema';
import {
  serializeLocationPing,
  serializeTrackingSession,
  type LocationPingResponse,
  type TrackingHeatmapCellResponse,
  type TrackingHistoryResponse,
  type TrackingSessionResponse,
} from './tracking.serializer';

export interface StartTrackingInput {
  organization: string;
  employeeId: string;
  attendanceId: string;
  at: Date;
  location: { lat: number; lng: number; accuracy?: number } | null;
}

export interface TrackingPingResult {
  accepted: boolean;
  reason?: 'too_soon';
  nextPingAt: string | null;
  ping?: LocationPingResponse;
  session: TrackingSessionResponse;
}

export interface TrackingStopResult {
  stopped: boolean;
  session: TrackingSessionResponse | null;
}

interface GeoPoint {
  lat: number;
  lng: number;
}

interface CellAccumulator {
  latSum: number;
  lngSum: number;
  seconds: number;
  samples: number;
  firstAt: number;
  lastAt: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Location-tracking business logic. GPS only exists in the employee's browser,
 * so check-in opens a session and the client posts a ping every five minutes;
 * the server enforces the interval and turns the ordered pings into a
 * dwell-time heatmap for HR.
 */
export class TrackingService {
  private readonly repository = new TrackingRepository();

  /** Opens (or reuses) today's session and records the check-in fix. */
  async startForCheckIn(input: StartTrackingInput): Promise<TrackingSessionResponse> {
    const dayStart = startOfDay(input.at);
    const dayEnd = addDays(dayStart, 1);

    await this.repository.closeOpenSessionsBefore(input.employeeId, dayStart);

    const crew = await crewsService.findActiveForEmployee(
      input.organization,
      input.employeeId,
    );
    let session = await this.repository.findSessionByDay(
      input.employeeId,
      dayStart,
      dayEnd,
    );

    if (!session) {
      try {
        session = await this.repository.create({
          organization: input.organization,
          employee: input.employeeId,
          attendance: input.attendanceId,
          crew: crew?.id ?? null,
          crewName: crew?.name ?? null,
          workDate: dayStart,
          startedAt: input.at,
          endedAt: null,
          lastPingAt: null,
          pingCount: 0,
          intervalMinutes: TRACKING_INTERVAL_MINUTES,
          status: 'active',
        });
      } catch (error) {
        // Two check-in requests raced; use the session created by the winner.
        if (!isDuplicateKey(error)) throw error;
        session = await this.repository.findSessionByDay(
          input.employeeId,
          dayStart,
          dayEnd,
        );
        if (!session) throw error;
      }
    } else {
      const updates: Record<string, unknown> = {};
      if (session.status === 'ended') {
        updates.status = 'active';
        updates.endedAt = null;
      }
      if (crew?.id !== session.crewId || crew?.name !== session.crewName) {
        updates.crew = crew?.id ?? null;
        updates.crewName = crew?.name ?? null;
      }
      if (Object.keys(updates).length > 0) {
        session = await this.repository.update(session.id, updates);
      }
    }

    if (input.location) {
      // The first fix of the day always counts. Later check-ins only add a
      // tracking sample once the normal five-minute gate has elapsed; the
      // attendance punch itself still records every manual registration.
      const intervalMs = session.intervalMinutes * 60 * 1000;
      const minimumElapsed =
        intervalMs - TRACKING_PING_TOLERANCE_SECONDS * 1000;
      const elapsed = session.lastPingAt
        ? input.at.getTime() - session.lastPingAt.getTime()
        : Number.POSITIVE_INFINITY;
      if (elapsed >= minimumElapsed) {
        await this.repository.createPing({
          organization: input.organization,
          employee: input.employeeId,
          attendance: input.attendanceId,
          session: session.id,
          crew: crew?.id ?? null,
          crewName: crew?.name ?? null,
          at: input.at,
          lat: input.location.lat,
          lng: input.location.lng,
          accuracy: input.location.accuracy ?? null,
          source: 'checkin',
        });
        session = await this.repository.addPing(session.id, input.at);
      }
    }

    return serializeTrackingSession(session);
  }

  /**
   * Records an interval ping. Early pings are not an error: the client gets
   * `accepted: false` plus the next allowed time and can simply wait.
   */
  async recordPing(
    user: AccessTokenPayload,
    input: TrackingPingInput,
  ): Promise<TrackingPingResult> {
    const employee = await employeesService.findMyProfile(user.email);
    if (!employee) throw new NotFoundError('Employee profile');
    if (employee.status !== 'active') {
      throw new ForbiddenError('This account is inactive. Contact HR.');
    }

    const organization = employee.organization ?? user.sub;
    const now = new Date();
    const dayStart = startOfDay(now);
    const session = await this.repository.findSessionByDay(
      employee.id,
      dayStart,
      addDays(dayStart, 1),
    );

    if (!session) {
      throw new BadRequestError('Check in before sharing your location');
    }
    if (session.status !== 'active') {
      throw new BadRequestError('Tracking session has ended');
    }

    const intervalMs = session.intervalMinutes * 60 * 1000;
    if (session.lastPingAt) {
      const elapsed = now.getTime() - session.lastPingAt.getTime();
      const minimumElapsed =
        intervalMs - TRACKING_PING_TOLERANCE_SECONDS * 1000;
      if (elapsed < minimumElapsed) {
        return {
          accepted: false,
          reason: 'too_soon',
          nextPingAt: new Date(session.lastPingAt.getTime() + intervalMs).toISOString(),
          session: serializeTrackingSession(session),
        };
      }
    }

    const crew = await crewsService.findActiveForEmployee(organization, employee.id);
    if (crew?.id !== session.crewId || crew?.name !== session.crewName) {
      await this.repository.update(session.id, {
        crew: crew?.id ?? null,
        crewName: crew?.name ?? null,
      });
    }

    const ping = await this.repository.createPing({
      organization,
      employee: employee.id,
      attendance: session.attendanceId,
      session: session.id,
      crew: crew?.id ?? null,
      crewName: crew?.name ?? null,
      at: now,
      lat: input.latitude,
      lng: input.longitude,
      accuracy: input.accuracy ?? null,
      source: 'interval',
    });
    const updated = await this.repository.addPing(session.id, now);

    return {
      accepted: true,
      nextPingAt: new Date(now.getTime() + intervalMs).toISOString(),
      ping: serializeLocationPing(ping),
      session: serializeTrackingSession(updated),
    };
  }

  /** Ends the employee's active session explicitly. */
  async stop(user: AccessTokenPayload): Promise<TrackingStopResult> {
    const employee = await employeesService.findMyProfile(user.email);
    if (!employee) throw new NotFoundError('Employee profile');

    const now = new Date();
    const dayStart = startOfDay(now);
    const session = await this.repository.findSessionByDay(
      employee.id,
      dayStart,
      addDays(dayStart, 1),
    );
    if (!session) return { stopped: false, session: null };
    if (session.status !== 'active') {
      return { stopped: false, session: serializeTrackingSession(session) };
    }

    const ended = await this.repository.endSession(session.id, now);
    return { stopped: true, session: serializeTrackingSession(ended) };
  }

  /** Current employee-facing session state (null when never checked in today). */
  async getActive(user: AccessTokenPayload): Promise<TrackingSessionResponse | null> {
    const employee = await employeesService.findMyProfile(user.email);
    if (!employee) return null;

    const now = new Date();
    const dayStart = startOfDay(now);
    const session = await this.repository.findSessionByDay(
      employee.id,
      dayStart,
      addDays(dayStart, 1),
    );
    return session?.status === 'active' ? serializeTrackingSession(session) : null;
  }

  /** HR map history: ordered movement plus dwell-time heatmap cells. */
  async history(
    user: AccessTokenPayload,
    query: TrackingHistoryQuery,
  ): Promise<TrackingHistoryResponse> {
    const employee = await employeesService.findByRefInOrganization(
      query.employeeRef,
      user.sub,
    );
    const [sessions, pings] = await Promise.all([
      this.repository.findSessionsForEmployee(employee.id, query.from, query.to),
      this.repository.findPingsForEmployee(
        user.sub,
        employee.id,
        query.from,
        query.to,
        query.maxAccuracyM,
      ),
    ]);

    const heatmap = this.buildHeatmap(pings, sessions, query.cellMeters);
    const topLocation = heatmap.cells[0] ?? null;

    return {
      employee: {
        id: employee.id,
        employeeRef: employee.employeeRef,
        fullName: employee.fullName,
      },
      from: toIsoDate(query.from),
      to: toIsoDate(addDays(query.to, -1)),
      intervalMinutes: TRACKING_INTERVAL_MINUTES,
      sessions: sessions.map(serializeTrackingSession),
      pings: pings.map(serializeLocationPing),
      heatmap: heatmap.cells,
      summary: {
        totalPings: pings.length,
        trackedSeconds: heatmap.totalSeconds,
        trackedMinutes: round(heatmap.totalSeconds / 60, 1),
        distanceMeters: Math.round(heatmap.distanceMeters),
        sessions: sessions.length,
        topLocation,
      },
      filters: {
        cellMeters: query.cellMeters,
        maxAccuracyM: query.maxAccuracyM ?? null,
      },
    };
  }

  /**
   * Converts ordered pings into grid cells. Each ping represents the time until
   * the next ping, capped at the session interval; the last ping of an active
   * session represents time until "now" (also capped). This avoids attributing
   * an unknown network gap to one location.
   */
  private buildHeatmap(
    pings: LocationPingRow[],
    sessions: TrackingSessionRow[],
    cellMeters: number,
  ): {
    cells: TrackingHeatmapCellResponse[];
    totalSeconds: number;
    distanceMeters: number;
  } {
    if (pings.length === 0) {
      return { cells: [], totalSeconds: 0, distanceMeters: 0 };
    }

    const sessionById = new Map(sessions.map((session) => [session.id, session]));
    const groups = new Map<string, LocationPingRow[]>();
    for (const ping of pings) {
      const group = groups.get(ping.sessionId);
      if (group) group.push(ping);
      else groups.set(ping.sessionId, [ping]);
    }

    const meanLat =
      pings.reduce((sum, ping) => sum + ping.lat, 0) / pings.length;
    const latStep = cellMeters / 111_320;
    const lngStep =
      cellMeters /
      (111_320 * Math.max(0.01, Math.cos((meanLat * Math.PI) / 180)));
    const cells = new Map<string, CellAccumulator>();
    const now = Date.now();
    let distanceMeters = 0;

    for (const [sessionId, group] of groups) {
      const session = sessionById.get(sessionId);
      const intervalSeconds = (session?.intervalMinutes ?? TRACKING_INTERVAL_MINUTES) * 60;

      for (let index = 0; index < group.length; index += 1) {
        const ping = group[index];
        if (!ping) continue;

        if (index > 0) {
          const previous = group[index - 1];
          if (previous) distanceMeters += haversineMeters(previous, ping);
        }

        const next = group[index + 1];
        const end = next
          ? next.at.getTime()
          : session?.endedAt?.getTime() ??
            Math.min(now, ping.at.getTime() + intervalSeconds * 1000);
        const seconds = Math.max(
          0,
          Math.min((end - ping.at.getTime()) / 1000, intervalSeconds),
        );
        if (seconds <= 0) continue;

        const id = `${Math.floor(ping.lat / latStep)}:${Math.floor(ping.lng / lngStep)}`;
        let cell = cells.get(id);
        if (!cell) {
          cell = {
            latSum: 0,
            lngSum: 0,
            seconds: 0,
            samples: 0,
            firstAt: ping.at.getTime(),
            lastAt: ping.at.getTime(),
          };
          cells.set(id, cell);
        }

        cell.latSum += ping.lat * seconds;
        cell.lngSum += ping.lng * seconds;
        cell.seconds += seconds;
        cell.samples += 1;
        cell.firstAt = Math.min(cell.firstAt, ping.at.getTime());
        cell.lastAt = Math.max(cell.lastAt, ping.at.getTime());
      }
    }

    const totalSeconds = [...cells.values()].reduce(
      (sum, cell) => sum + cell.seconds,
      0,
    );
    const maxSeconds = Math.max(
      1,
      ...[...cells.values()].map((cell) => cell.seconds),
    );

    const response = [...cells.entries()]
      .filter(([, cell]) => cell.seconds > 0)
      .map(([id, cell]) => ({
        id,
        lat: round(cell.latSum / cell.seconds, 6),
        lng: round(cell.lngSum / cell.seconds, 6),
        durationSeconds: Math.round(cell.seconds),
        durationMinutes: round(cell.seconds / 60, 1),
        relativeTime: round(cell.seconds / totalSeconds, 4),
        weight: round(cell.seconds / maxSeconds, 4),
        samples: cell.samples,
        firstAt: new Date(cell.firstAt).toISOString(),
        lastAt: new Date(cell.lastAt).toISOString(),
      }))
      .sort((a, b) => b.durationSeconds - a.durationSeconds);

    return {
      cells: response,
      totalSeconds: Math.round(totalSeconds),
      distanceMeters,
    };
  }
}

export const trackingService = new TrackingService();
