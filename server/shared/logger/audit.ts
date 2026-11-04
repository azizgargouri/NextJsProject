/**
 * Audit event logging — replicates instanct-api's @LogEvent(EventType.X)
 * interceptor as a plain server-side recorder. Events persist to the
 * `auditevents` MongoDB collection and power the back-office audit log.
 */
import { connectMongo } from '../database/mongoose';
import { AuditEventModel, type AuditEventDoc } from '../database/models/audit-event.model';

/** Mongoose 9 no longer exports FilterQuery; simple clause objects are typed here. */
type AuditEventFilter = Record<string, unknown>;

export enum EventType {
  SIGNIN = 'SIGNIN',
  SIGNOUT = 'SIGNOUT',
  SIGNUP = 'SIGNUP',
  REFRESH_TOKEN = 'REFRESH_TOKEN',
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_STATUS = 'USER_STATUS',
  PRICING_CREATE = 'PRICING_CREATE',
  PRICING_UPDATE = 'PRICING_UPDATE',
  PRICING_DELETE = 'PRICING_DELETE',
  CONTENT_UPDATE = 'CONTENT_UPDATE',
  EMPLOYEE_CREATE = 'EMPLOYEE_CREATE',
  EMPLOYEE_UPDATE = 'EMPLOYEE_UPDATE',
  ATTENDANCE_CHECKIN = 'ATTENDANCE_CHECKIN',
  LEAVE_CREATE = 'LEAVE_CREATE',
  LEAVE_DECIDE = 'LEAVE_DECIDE',
}

export const EVENT_TYPES = Object.values(EventType) as [EventType, ...EventType[]];

export interface AuditLogRecord {
  event: EventType;
  userId?: string;
  method: string;
  api: string;
  logInfo?: Record<string, unknown>;
}

/** Row shape returned to the admin audit-log endpoint. */
export interface AuditEventRow {
  id: string;
  event: EventType;
  userId: string | null;
  method: string;
  api: string;
  logInfo: Record<string, unknown>;
  createdAt: string;
}

export function serializeAuditEvent(doc: AuditEventDoc): AuditEventRow {
  return {
    id: String(doc._id),
    event: doc.event as EventType,
    userId: doc.userId ?? null,
    method: doc.method,
    api: doc.api,
    logInfo: doc.logInfo ?? {},
    createdAt: doc.createdAt.toISOString(),
  };
}

/** Count events, optionally filtered by event type — used by admin overviews. */
export async function countAuditEvents(event?: EventType): Promise<number> {
  await connectMongo();
  const where: AuditEventFilter = event ? { event } : {};
  return AuditEventModel.countDocuments(where);
}

/**
 * Fire-and-forget recorder — never blocks or throws into the request path.
 * Persistence failures surface as console errors in development only.
 */
export function logEvent(record: AuditLogRecord): void {
  void (async () => {
    await connectMongo();
    await AuditEventModel.create({
      event: record.event,
      userId: record.userId,
      method: record.method,
      api: record.api,
      logInfo: record.logInfo ?? {},
    });
  })().catch((error) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[audit] failed to persist event=${record.event}`, error);
    }
  });

  if (process.env.NODE_ENV === 'development') {
    // Structured single-line log keeps dev console readable.
    console.log(
      `[audit] event=${record.event} userId=${record.userId ?? '-'} method=${record.method} api=${record.api}`,
    );
  }
}
