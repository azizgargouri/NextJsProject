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
  /** Same-origin avatar URL (versioned for cache busting) or null when none is set. */
  avatarUrl: string | null;
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
  | 'PROFILE_UPDATE'
  | 'AVATAR_UPDATE'
  | 'PASSWORD_CHANGE'
  | 'SESSION_REVOKE'
  | 'STORAGE_DELETE';

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

// ── Account (self-service) ─────────────────────────────────────────────

export interface ProfileUpdatePayload {
  name?: string;
  phone?: string;
  locale?: 'en' | 'fr' | 'ar';
}

export interface PasswordChangePayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  signOutOtherSessions: boolean;
}

export interface AccountSessionDto {
  id: string;
  userAgent: string | null;
  startedAt: string;
  lastActiveAt: string;
  expiresAt: string;
  current: boolean;
}

export interface AccountNotificationDto {
  id: string;
  event: AuditEventType;
  createdAt: string;
  unread: boolean;
  actor: { id: string; name: string; email: string } | null;
  logInfo: Record<string, string | undefined>;
}

export interface AccountNotificationsPage {
  data: AccountNotificationDto[];
  unreadCount: number;
  seenAt: string | null;
  nextBefore: string | null;
}

// ── Object storage (admin) ─────────────────────────────────────────────

export interface StorageStatusDto {
  reachable: boolean;
  bucket: string;
  endpoint: string;
  objectCount: number | null;
  totalBytes: number | null;
  prefixes: { prefix: string; objectCount: number; totalBytes: number }[];
}

export interface StorageObjectDto {
  key: string;
  size: number;
  lastModified: string | null;
  etag: string | null;
  owner: { id: string; name: string; email: string } | null;
  referenced: boolean;
}

export interface StorageObjectsPage {
  data: StorageObjectDto[];
  nextCursor: string | null;
}

export interface StorageObjectsQuery {
  prefix?: string;
  cursor?: string;
  limit?: number;
}
