/** Shared enum contracts for the Mongoose data layer (spec ch.4 domain enums). */

export const ROLES = ['CLIENT', 'MOVER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'BLOCKED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PRICING_STATUSES = ['ACTIVE', 'RETIRED'] as const;
export type PricingStatus = (typeof PRICING_STATUSES)[number];

export const VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const TIME_SLOTS = ['MORNING', 'AFTERNOON', 'FULL_DAY'] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];
export const DOCUMENT_TYPES = ['ID', 'LICENCE', 'INSURANCE', 'REGISTRATION'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const MESSAGE_THREADS = ['MOVER_CLIENT', 'MOVER_SUPPORT', 'CLIENT_SUPPORT'] as const;
export type MessageThread = (typeof MESSAGE_THREADS)[number];
export type MoveStatus = 'DRAFT' | 'SUBMITTED' | 'QUOTING' | 'ASSIGNED' | 'EN_ROUTE' | 'IN_PROGRESS' | 'DELIVERED' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED' | 'REFUNDED';
export type ProgressStage = 'LOADING' | 'IN_TRANSIT';
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'QUOTED' | 'EXPIRED' | 'WITHDRAWN';
export type QuoteStatus = 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type PhotoStage = 'REQUEST' | 'PICKUP' | 'LOAD' | 'DELIVERY' | 'CLAIM';
export type NotificationType = 'OFFER_NEW' | 'OFFER_EXPIRED' | 'OFFER_WITHDRAWN' | 'QUOTE_ACCEPTED' | 'QUOTE_REJECTED' | 'JOB_ASSIGNED' | 'JOB_STATUS' | 'JOB_COMPLETED' | 'MESSAGE' | 'DOCUMENT_EXPIRING' | 'PAYOUT';
export type VehicleType = 'VAN' | 'SMALL_TRUCK' | 'LARGE_TRUCK';
export type EarningStatus = 'PENDING' | 'PAID';
export const VEHICLE_TYPES = ['VAN', 'SMALL_TRUCK', 'LARGE_TRUCK'] as const;
export const MOVE_STATUSES = ['DRAFT', 'SUBMITTED', 'QUOTING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'REFUNDED'] as const;
export const PROGRESS_STAGES = ['LOADING', 'IN_TRANSIT'] as const;
export const OFFER_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED', 'QUOTED', 'EXPIRED', 'WITHDRAWN'] as const;
export const QUOTE_STATUSES = ['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;
export const PHOTO_STAGES = ['REQUEST', 'PICKUP', 'LOAD', 'DELIVERY', 'CLAIM'] as const;
export const NOTIFICATION_TYPES = ['OFFER_NEW', 'OFFER_EXPIRED', 'OFFER_WITHDRAWN', 'QUOTE_ACCEPTED', 'QUOTE_REJECTED', 'JOB_ASSIGNED', 'JOB_STATUS', 'JOB_COMPLETED', 'MESSAGE', 'DOCUMENT_EXPIRING', 'PAYOUT'] as const;
export const EARNING_STATUSES = ['PENDING', 'PAID'] as const;

// Quality domain (claims / reviews) — single source of truth lives in lib/quality.
export * from '../../../lib/quality/constants';

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

/* --- Crews & location tracking --- */

export const CREW_STATUSES = ['active', 'inactive'] as const;
export type CrewStatus = (typeof CREW_STATUSES)[number];

export const TRACKING_SESSION_STATUSES = ['active', 'ended'] as const;
export type TrackingSessionStatus = (typeof TRACKING_SESSION_STATUSES)[number];

export const LOCATION_PING_SOURCES = ['checkin', 'interval', 'manual'] as const;
export type LocationPingSource = (typeof LOCATION_PING_SOURCES)[number];

/* --- On-chain employment contracts --- */

export const CONTRACT_STATUSES = ['pending', 'active', 'terminated', 'superseded'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_PROPOSAL_STATUSES = [
  'awaiting_employee',
  'completed',
  'expired',
  'cancelled',
] as const;
export type ContractProposalStatus = (typeof CONTRACT_PROPOSAL_STATUSES)[number];

export const SALARY_PERIODS = ['month', 'year', 'hour'] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];
