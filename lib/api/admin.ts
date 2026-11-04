import { axiosClient } from './client';
import type {
  AdminAuditQuery,
  AdminClaimUpdatePayload,
  AdminClaimsQuery,
  AdminReviewsQuery,
  ClaimDto,
  QualityStatsDto,
  ReviewDto,
  ReviewStatus,
  AdminOverviewDto,
  AdminPricingQuery,
  AdminUserCreatePayload,
  AdminUserUpdatePayload,
  AdminUsersQuery,
  AuditEventDto,
  ContentBundleDto,
  ContentResetPayload,
  ContentSavePayload,
  PageDto,
  PricingRuleDto,
  PricingRulePayload,
  ResponseUserDto,
  UserStatus,
} from '@/types';

export const adminApi = {
  overview: async (): Promise<AdminOverviewDto> => {
    const { data } = await axiosClient.get<AdminOverviewDto>('/api/admin/overview');
    return data;
  },

  audit: async (query: AdminAuditQuery): Promise<PageDto<AuditEventDto>> => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.event && query.event !== 'ALL') params.set('event', query.event);
    const { data } = await axiosClient.get<PageDto<AuditEventDto>>('/api/admin/audit', { params });
    return data;
  },

  users: async (query: AdminUsersQuery): Promise<PageDto<ResponseUserDto>> => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.search) params.set('search', query.search);
    if (query.sort) params.set('sort', query.sort);
    if (query.role && query.role !== 'ALL') params.set('role', query.role);
    if (query.status && query.status !== 'ALL') params.set('status', query.status);

    const { data } = await axiosClient.get<PageDto<ResponseUserDto>>('/api/admin/users', {
      params,
    });
    return data;
  },

  setUserStatus: async (id: string, status: UserStatus): Promise<ResponseUserDto> => {
    const { data } = await axiosClient.patch<{ user: ResponseUserDto }>(
      `/api/admin/users/${id}/status`,
      { status },
    );
    return data.user;
  },

  user: async (id: string): Promise<ResponseUserDto> => {
    const { data } = await axiosClient.get<{ user: ResponseUserDto }>(`/api/admin/users/${id}`);
    return data.user;
  },

  createUser: async (payload: AdminUserCreatePayload): Promise<ResponseUserDto> => {
    const { data } = await axiosClient.post<{ user: ResponseUserDto }>('/api/admin/users', payload);
    return data.user;
  },

  updateUser: async (id: string, payload: AdminUserUpdatePayload): Promise<ResponseUserDto> => {
    const { data } = await axiosClient.patch<{ user: ResponseUserDto }>(
      `/api/admin/users/${id}`,
      payload,
    );
    return data.user;
  },

  deleteUser: async (id: string): Promise<ResponseUserDto> => {
    const { data } = await axiosClient.delete<{ user: ResponseUserDto }>(`/api/admin/users/${id}`);
    return data.user;
  },

  pricing: async (query: AdminPricingQuery): Promise<PageDto<PricingRuleDto>> => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.search) params.set('search', query.search);
    if (query.sort) params.set('sort', query.sort);
    if (query.status && query.status !== 'ALL') params.set('status', query.status);
    const { data } = await axiosClient.get<PageDto<PricingRuleDto>>('/api/admin/pricing', {
      params,
    });
    return data;
  },

  createPricingRule: async (payload: PricingRulePayload): Promise<PricingRuleDto> => {
    const { data } = await axiosClient.post<{ rule: PricingRuleDto }>(
      '/api/admin/pricing',
      payload,
    );
    return data.rule;
  },

  updatePricingRule: async (
    id: string,
    payload: Partial<PricingRulePayload>,
  ): Promise<PricingRuleDto> => {
    const { data } = await axiosClient.patch<{ rule: PricingRuleDto }>(
      `/api/admin/pricing/${id}`,
      payload,
    );
    return data.rule;
  },

  deletePricingRule: async (id: string): Promise<PricingRuleDto> => {
    const { data } = await axiosClient.delete<{ rule: PricingRuleDto }>(`/api/admin/pricing/${id}`);
    return data.rule;
  },

  content: async (locale: 'en' | 'fr' | 'ar'): Promise<ContentBundleDto> => {
    const { data } = await axiosClient.get<ContentBundleDto>('/api/admin/content', {
      params: { locale },
    });
    return data;
  },

  saveContent: async (payload: ContentSavePayload): Promise<{ locale: string; saved: number }> => {
    const { data } = await axiosClient.patch<{ locale: string; saved: number }>(
      '/api/admin/content',
      payload,
    );
    return data;
  },

  resetContent: async (
    payload: ContentResetPayload,
  ): Promise<{ locale: string; reset: number }> => {
    const { data } = await axiosClient.patch<{ locale: string; reset: number }>(
      '/api/admin/content?mode=reset',
      payload,
    );
    return data;
  },

  /* ---------- quality: disputes, review moderation, KPIs ---------- */

  quality: async (): Promise<QualityStatsDto> => {
    const { data } = await axiosClient.get<QualityStatsDto>('/api/admin/quality');
    return data;
  },

  claims: async (query: AdminClaimsQuery): Promise<PageDto<ClaimDto>> => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.search) params.set('search', query.search);
    for (const key of ['status', 'priority', 'category'] as const) {
      const value = query[key];
      if (value && value !== 'ALL') params.set(key, value);
    }
    const { data } = await axiosClient.get<PageDto<ClaimDto>>('/api/admin/claims', { params });
    return data;
  },

  claim: async (id: string): Promise<ClaimDto> => {
    const { data } = await axiosClient.get<{ claim: ClaimDto }>(`/api/admin/claims/${id}`);
    return data.claim;
  },

  updateClaim: async (id: string, payload: AdminClaimUpdatePayload): Promise<ClaimDto> => {
    const { data } = await axiosClient.patch<{ claim: ClaimDto }>(
      `/api/admin/claims/${id}`,
      payload,
    );
    return data.claim;
  },

  reviews: async (query: AdminReviewsQuery): Promise<PageDto<ReviewDto>> => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.status && query.status !== 'ALL') params.set('status', query.status);
    if (query.sentiment && query.sentiment !== 'ALL') params.set('sentiment', query.sentiment);
    if (query.maxRating) params.set('maxRating', String(query.maxRating));
    const { data } = await axiosClient.get<PageDto<ReviewDto>>('/api/admin/reviews', { params });
    return data;
  },

  moderateReview: async (id: string, status: ReviewStatus, note?: string): Promise<ReviewDto> => {
    const { data } = await axiosClient.patch<{ review: ReviewDto }>(`/api/admin/reviews/${id}`, {
      status,
      note,
    });
    return data.review;
  },
};
