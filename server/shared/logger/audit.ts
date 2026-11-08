/**
 * Audit event logging — replicates instanct-api's @LogEvent(EventType.X)
 * interceptor as a plain server-side recorder (fire-and-forget).
 */
export enum EventType {
  SIGNIN = 'SIGNIN',
  SIGNOUT = 'SIGNOUT',
  SIGNUP = 'SIGNUP',
  REFRESH_TOKEN = 'REFRESH_TOKEN',
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  EMPLOYEE_CREATE = 'EMPLOYEE_CREATE',
  EMPLOYEE_UPDATE = 'EMPLOYEE_UPDATE',
  ATTENDANCE_CHECKIN = 'ATTENDANCE_CHECKIN',
  LEAVE_CREATE = 'LEAVE_CREATE',
  LEAVE_DECIDE = 'LEAVE_DECIDE',
  CREW_CREATE = 'CREW_CREATE',
  CREW_UPDATE = 'CREW_UPDATE',
  CREW_MEMBER_ADD = 'CREW_MEMBER_ADD',
  CREW_MEMBER_REMOVE = 'CREW_MEMBER_REMOVE',
  TRACKING_PING = 'TRACKING_PING',
  TRACKING_STOP = 'TRACKING_STOP',
  CONTRACT_PREPARE = 'CONTRACT_PREPARE',
  CONTRACT_PROPOSE = 'CONTRACT_PROPOSE',
  CONTRACT_SIGN = 'CONTRACT_SIGN',
  CONTRACT_CREATE = 'CONTRACT_CREATE',
  CONTRACT_ACCEPT = 'CONTRACT_ACCEPT',
  CONTRACT_TERMINATE = 'CONTRACT_TERMINATE',
}

export interface AuditLogRecord {
  event: EventType;
  userId?: string;
  method: string;
  api: string;
  logInfo?: Record<string, unknown>;
}

const records: AuditLogRecord[] = [];

export function logEvent(record: AuditLogRecord): void {
  // Fire-and-forget; replace the sink with an AuditLog collection / winston later.
  records.push({ ...record, logInfo: record.logInfo ?? {} });

  if (process.env.NODE_ENV === 'development') {
    // Structured single-line log keeps dev console readable.
    console.log(
      `[audit] event=${record.event} userId=${record.userId ?? '-'} method=${record.method} api=${record.api}`,
    );
  }
}
