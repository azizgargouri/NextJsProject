/** Shared enum contracts for the Mongoose data layer (spec ch.4 domain enums). */

export const ROLES = ['CLIENT', 'MOVER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'BLOCKED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/* --- RH / employee-tracking domain (ported from the Employee & HR module) --- */

export const EMPLOYEE_ROLES = ['hr', 'manager', 'employee'] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export const EMPLOYEE_STATUSES = ['active', 'inactive', 'pending'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const ATTENDANCE_STATUSES = ['present', 'late', 'leave', 'halfDay', 'absent'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const LEAVE_TYPES = ['annual', 'sick', 'personal', 'unpaid'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const LEAVE_DECISIONS = ['approved', 'rejected'] as const;

export const WORK_SCHEDULE_STATUSES = ['planned', 'confirmed', 'completed', 'cancelled'] as const;
export type WorkScheduleStatus = (typeof WORK_SCHEDULE_STATUSES)[number];
