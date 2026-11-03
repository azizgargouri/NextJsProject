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
  | 'USER_STATUS'
  | 'CLAIM_CREATE'
  | 'CLAIM_MESSAGE'
  | 'CLAIM_STATUS'
  | 'REVIEW_CREATE'
  | 'REVIEW_REPLY'
  | 'REVIEW_MODERATE'
  | 'AI_REQUEST';

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

/* ------------------------------------------------------------------ */
/* Quality domain — claims, reviews, AI (member 6, v2)                 */
/* ------------------------------------------------------------------ */

export type {
  AnalysisSource,
  ClaimCategory,
  ClaimOutcome,
  ClaimPriority,
  ClaimStatus,
  ReviewStatus,
  ReviewTopic,
  Sentiment,
} from '@/lib/quality/constants';
export type { ClaimTriage, ReviewInsights, ReviewModeration } from '@/lib/quality/ai-schemas';

import type {
  AnalysisSource,
  ClaimCategory,
  ClaimOutcome,
  ClaimPriority,
  ClaimStatus,
  ReviewStatus,
  ReviewTopic,
  Sentiment,
} from '@/lib/quality/constants';

export interface UserRefDto {
  id: string;
  name: string;
  email?: string;
  role?: UserRole;
}

export interface ClaimEventDto {
  kind: 'CREATED' | 'MESSAGE' | 'STATUS_CHANGED' | 'RESOLUTION';
  author: UserRefDto | null;
  authorRole: UserRole;
  text: string;
  status: ClaimStatus | null;
  createdAt: string;
}

export interface ClaimDto {
  id: string;
  reference: string;
  status: ClaimStatus;
  category: ClaimCategory;
  subject: string;
  description: string;
  amountClaimed: number | null;
  moveReference: string | null;
  client: UserRefDto | null;
  mover: UserRefDto | null;
  resolution: {
    outcome: ClaimOutcome;
    amount: number | null;
    note: string;
    resolvedAt: string;
  } | null;
  timeline: ClaimEventDto[];
  createdAt: string;
  updatedAt: string;
  priority?: ClaimPriority;
  aiTriage?: {
    source: AnalysisSource;
    category: ClaimCategory;
    priority: ClaimPriority;
    summary: string;
    suggestedAction: string;
    sentiment: Sentiment;
    confidence: number;
    model: string | null;
  } | null;
}

export interface AdminClaimsQuery extends QueryParams {
  status?: ClaimStatus | 'ALL';
  priority?: ClaimPriority | 'ALL';
  category?: ClaimCategory | 'ALL';
}

export interface AdminClaimUpdatePayload {
  status?: ClaimStatus;
  priority?: ClaimPriority;
  note?: string;
  resolution?: { outcome: ClaimOutcome; amount?: number | null; note: string };
}

export interface ReviewDto {
  id: string;
  moveReference: string;
  rating: number;
  punctuality: number | null;
  care: number | null;
  communication: number | null;
  comment: string;
  status: ReviewStatus;
  client: UserRefDto | null;
  mover: UserRefDto | null;
  moverReply: { text: string; createdAt: string } | null;
  createdAt: string;
  moderationNote?: string | null;
  moderation?: {
    source: AnalysisSource;
    sentiment: Sentiment;
    toxic: boolean;
    reasons: string[];
    topics: ReviewTopic[];
    model: string | null;
  } | null;
}

export interface AdminReviewsQuery extends QueryParams {
  status?: ReviewStatus | 'ALL';
  sentiment?: Sentiment | 'ALL';
  maxRating?: number;
}

export interface RatingSummaryDto {
  average: number | null;
  count: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
  punctuality: number | null;
  care: number | null;
  communication: number | null;
}

export interface QualityStatsDto {
  claims: {
    byStatus: Record<ClaimStatus, number>;
    urgentOpen: number;
    avgResolutionHours: number | null;
  };
  reviews: {
    byStatus: Record<ReviewStatus, number>;
    averageRating: number | null;
    published: number;
    negative: number;
  };
  ai: {
    enabled: boolean;
    provider: string;
    model: string;
    tokensLast30Days: number;
    questionsLast30Days: number;
    activeUsers: number;
  };
}

export interface ChatHistoryDto {
  enabled: boolean;
  limitPerHour: number;
  messages: { id: string; role: 'user' | 'assistant'; content: string; createdAt: string }[];
}
