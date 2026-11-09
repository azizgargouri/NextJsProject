import type {
  LocationPingSource,
  TrackingSessionStatus,
} from '../../shared/database/enums';
import type {
  LocationPingRow,
  TrackingSessionRow,
} from './tracking.repository';

export interface TrackingCrewResponse {
  id: string;
  name: string;
}

/** Client-facing tracking state returned by check-in, ping and stop. */
export interface TrackingSessionResponse {
  id: string;
  employeeId: string;
  attendanceId: string;
  crew: TrackingCrewResponse | null;
  workDate: string;
  startedAt: string;
  endedAt: string | null;
  lastPingAt: string | null;
  pingCount: number;
  intervalMinutes: number;
  /** Next allowed ping time; null once the session has ended. */
  nextPingAt: string | null;
  status: TrackingSessionStatus;
  active: boolean;
}

export interface LocationPingResponse {
  id: string;
  sessionId: string;
  at: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  source: LocationPingSource;
  crew: TrackingCrewResponse | null;
}

export interface TrackingHeatmapCellResponse {
  id: string;
  lat: number;
  lng: number;
  durationSeconds: number;
  durationMinutes: number;
  /** Share of all tracked time spent in this cell (0..1). */
  relativeTime: number;
  /** Relative to the busiest cell (0..1) — convenient for Leaflet.heat. */
  weight: number;
  samples: number;
  firstAt: string;
  lastAt: string;
}

export interface TrackingHistoryResponse {
  employee: {
    id: string;
    employeeRef: string;
    fullName: string;
  };
  /** Inclusive local dates. */
  from: string;
  to: string;
  intervalMinutes: number;
  sessions: TrackingSessionResponse[];
  pings: LocationPingResponse[];
  heatmap: TrackingHeatmapCellResponse[];
  summary: {
    totalPings: number;
    trackedSeconds: number;
    trackedMinutes: number;
    distanceMeters: number;
    sessions: number;
    topLocation: TrackingHeatmapCellResponse | null;
  };
  filters: {
    cellMeters: number;
    maxAccuracyM: number | null;
  };
}

function nextPingAt(row: TrackingSessionRow): string | null {
  if (row.status !== 'active') return null;
  if (!row.lastPingAt) return row.startedAt.toISOString();
  return new Date(
    row.lastPingAt.getTime() + row.intervalMinutes * 60 * 1000,
  ).toISOString();
}

export function serializeTrackingSession(
  row: TrackingSessionRow,
): TrackingSessionResponse {
  return {
    id: row.id,
    employeeId: row.employeeId,
    attendanceId: row.attendanceId,
    crew: row.crewId
      ? { id: row.crewId, name: row.crewName ?? 'Crew' }
      : null,
    workDate: row.workDate.toISOString(),
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    lastPingAt: row.lastPingAt?.toISOString() ?? null,
    pingCount: row.pingCount,
    intervalMinutes: row.intervalMinutes,
    nextPingAt: nextPingAt(row),
    status: row.status,
    active: row.status === 'active',
  };
}

export function serializeLocationPing(row: LocationPingRow): LocationPingResponse {
  return {
    id: row.id,
    sessionId: row.sessionId,
    at: row.at.toISOString(),
    lat: row.lat,
    lng: row.lng,
    accuracy: row.accuracy,
    source: row.source,
    crew: row.crewId ? { id: row.crewId, name: row.crewName ?? 'Crew' } : null,
  };
}
