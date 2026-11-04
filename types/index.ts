/** Base fields replicated from the instanct DatabaseEntity. */
export interface DatabaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'CLIENT' | 'MOVER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'BLOCKED';

export interface ResponseUserDto extends DatabaseEntity {
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  locale: string;
  status: UserStatus;
}

export interface ApiUserResponse {
  user: ResponseUserDto;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ServerResponse<T> {
  data?: T;
  result?: T;
  user?: T;
  message?: string;
}

export interface ServerErrorResponse {
  message: string;
  code: string;
  details?: unknown;
}

export interface PageMetaDto {
  page: number;
  take: number;
  itemCount: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PageDto<T> {
  data: T[];
  meta: PageMetaDto;
}

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  filter?: string;
}

/* --- RH / employee-tracking DTOs (mirror the server serializers) --- */

export type EmployeeRole = 'hr' | 'manager' | 'employee';
export type EmployeeStatus = 'active' | 'inactive' | 'pending';
export type AttendanceStatus = 'present' | 'late' | 'leave' | 'halfDay' | 'absent';
export type LeaveType = 'annual' | 'sick' | 'personal' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

/** Compact employee reference embedded in attendance / leave rows. */
export interface EmployeeRefDto {
  id: string;
  employeeRef: string;
  fullName: string;
}

export interface EmployeeDto extends DatabaseEntity {
  employeeRef: string;
  fullName: string;
  email: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  hireDate: string | null;
  organization: string | null;
}

export interface AttendanceLocationDto {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface AttendanceDto extends DatabaseEntity {
  employee: EmployeeRefDto | null;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  status: AttendanceStatus;
  breakDuration: number;
  location: AttendanceLocationDto | null;
}

export interface LeaveRequestDto extends DatabaseEntity {
  employee: EmployeeRefDto | null;
  type: LeaveType;
  startDate: string;
  endDate: string;
  daysRequested: number;
  status: LeaveStatus;
  reason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface DashboardStatsDto {
  rangeFrom: string;
  rangeTo: string;
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  employeesScheduledToday: number;
  employeesPresentToday: number;
  employeesLateToday: number;
  confirmedAbsencesToday: number;
  employeesNotCheckedIn: number;
  pendingLeaveRequests: number;
  upcomingWorkdays: { date: string; scheduledEmployees: number }[];
}

/** Payload posted by the geolocated check-in card. */
export interface CheckInPayload {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  updateLocationOnly?: boolean;
}

export interface CheckInResponse {
  success: boolean;
  alreadyCheckedIn?: boolean;
  updatedLocation?: boolean;
  attendance: AttendanceDto;
}

/* --- Admin Back-Office DTOs --- */

export interface AdminOverviewDto {
  users: {
    total: number;
    active: number;
    blocked: number;
    clients: number;
    movers: number;
    admins: number;
    registeredLast30Days: number;
  };
  movers: {
    pendingReview: number;
    approved: number;
  };
}

export interface AdminUsersQuery extends QueryParams {
  role?: UserRole | 'ALL';
  status?: UserStatus | 'ALL';
}

export type AuditEventType =
  | 'SIGNIN'
  | 'SIGNOUT'
  | 'SIGNUP'
  | 'REFRESH_TOKEN'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'USER_STATUS'
  | 'PRICING_CREATE'
  | 'PRICING_UPDATE'
  | 'PRICING_DELETE'
  | 'CONTENT_UPDATE'
  | 'EMPLOYEE_CREATE'
  | 'EMPLOYEE_UPDATE'
  | 'ATTENDANCE_CHECKIN'
  | 'LEAVE_CREATE'
  | 'LEAVE_DECIDE';

export interface AuditEventDto {
  id: string;
  event: AuditEventType;
  userId: string | null;
  actor: { id: string; name: string; email: string } | null;
  method: string;
  api: string;
  logInfo: Record<string, string | undefined>;
  createdAt: string;
}

export interface AdminAuditQuery extends QueryParams {
  event?: AuditEventType | 'ALL';
}

export interface AdminUserCreatePayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  locale: 'en' | 'fr' | 'ar';
  status: UserStatus;
}

export interface AdminUserUpdatePayload {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: UserRole;
  locale?: 'en' | 'fr' | 'ar';
  status?: UserStatus;
}

export type PricingStatus = 'ACTIVE' | 'RETIRED';

export interface PricingRuleDto {
  id: string;
  name: string;
  status: PricingStatus;
  currency: string;
  baseFare: number;
  perKm: number;
  perM3: number;
  expressSurcharge: number;
  minQuote: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPricingQuery extends QueryParams {
  status?: PricingStatus | 'ALL';
}

export interface PricingRulePayload {
  name: string;
  status: PricingStatus;
  baseFare: number;
  perKm: number;
  perM3: number;
  expressSurcharge: number;
  minQuote: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface ContentEntryDto {
  key: string;
  label: string;
  value: string;
  default: string;
  overridden: boolean;
  multiline: boolean;
}

export interface ContentSectionDto {
  section: 'hero' | 'steps' | 'coverage';
  title: string;
  description: string;
  entries: ContentEntryDto[];
}

export interface ContentBundleDto {
  locale: 'en' | 'fr' | 'ar';
  sections: ContentSectionDto[];
}

export interface ContentSavePayload {
  locale: 'en' | 'fr' | 'ar';
  entries: { key: string; value: string }[];
}

export interface ContentResetPayload {
  locale: 'en' | 'fr' | 'ar';
  keys: string[];
}

export * from './homes';
