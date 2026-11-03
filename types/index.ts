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
  | 'USER_STATUS';

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
