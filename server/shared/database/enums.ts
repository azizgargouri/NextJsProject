/** Shared enum contracts for the Mongoose data layer (spec ch.4 domain enums). */

export const ROLES = ['CLIENT', 'MOVER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'BLOCKED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PRICING_STATUSES = ['ACTIVE', 'RETIRED'] as const;
export type PricingStatus = (typeof PRICING_STATUSES)[number];

export const VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Move lifecycle (spec 9.1). The server rejects any transition not listed there. */
export const MOVE_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'QUOTING',
  'ASSIGNED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'DELIVERED',
  'COMPLETED',
  'DISPUTED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type MoveStatus = (typeof MOVE_STATUSES)[number];

/** IN_PROGRESS covers "loading and transport"; M-06 reports them as two separate steps. */
export const PROGRESS_STAGES = ['LOADING', 'IN_TRANSIT'] as const;
export type ProgressStage = (typeof PROGRESS_STAGES)[number];

export const TIME_SLOTS = ['MORNING', 'AFTERNOON', 'FULL_DAY'] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

export const OFFER_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'QUOTED',
  'EXPIRED',
  'WITHDRAWN',
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const QUOTE_STATUSES = ['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** One conversation per pair of parties on a move. */
export const MESSAGE_THREADS = ['MOVER_CLIENT', 'MOVER_SUPPORT', 'CLIENT_SUPPORT'] as const;
export type MessageThread = (typeof MESSAGE_THREADS)[number];

export const PHOTO_STAGES = ['REQUEST', 'PICKUP', 'LOAD', 'DELIVERY', 'CLAIM'] as const;
export type PhotoStage = (typeof PHOTO_STAGES)[number];

export const VEHICLE_TYPES = ['VAN', 'SMALL_TRUCK', 'LARGE_TRUCK'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const DOCUMENT_TYPES = ['ID', 'LICENCE', 'INSURANCE', 'REGISTRATION'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const EARNING_STATUSES = ['PENDING', 'PAID'] as const;
export type EarningStatus = (typeof EARNING_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'OFFER_NEW',
  'OFFER_EXPIRED',
  'OFFER_WITHDRAWN',
  'QUOTE_ACCEPTED',
  'QUOTE_REJECTED',
  'JOB_ASSIGNED',
  'JOB_STATUS',
  'JOB_COMPLETED',
  'MESSAGE',
  'DOCUMENT_EXPIRING',
  'PAYOUT',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
