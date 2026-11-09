import { axiosClient } from './client';
import type {
  AdminAuditQuery,
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
  StorageObjectsPage,
  StorageObjectsQuery,
  StorageStatusDto,
  UserStatus,
  AdminClaimUpdatePayload, AdminClaimsQuery, AdminReviewsQuery, ClaimDto, QualityStatsDto, ReviewDto, ReviewStatus,
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

  storageStatus: async (): Promise<StorageStatusDto> => {
    const { data } = await axiosClient.get<StorageStatusDto>('/api/admin/storage');
    return data;
  },

  storageObjects: async (query: StorageObjectsQuery): Promise<StorageObjectsPage> => {
    const params = new URLSearchParams();
    if (query.prefix) params.set('prefix', query.prefix);
    if (query.cursor) params.set('cursor', query.cursor);
    if (query.limit) params.set('limit', String(query.limit));
    const { data } = await axiosClient.get<StorageObjectsPage>('/api/admin/storage/objects', {
      params,
    });
    return data;
  },

  downloadStorageObject: async (key: string): Promise<Blob> => {
    const { data } = await axiosClient.get<Blob>('/api/admin/storage/objects', {
      params: { key },
      responseType: 'blob',
      timeout: 60000,
    });
    return data;
  },

  deleteStorageObject: async (
    key: string,
  ): Promise<{ key: string; detachedUserId: string | null }> => {
    const { data } = await axiosClient.delete<{ key: string; detachedUserId: string | null }>(
      '/api/admin/storage/objects',
      { params: { key } },
    );
    return data;
  },

  quality: async (): Promise<QualityStatsDto> => (await axiosClient.get<QualityStatsDto>('/api/admin/quality')).data,
  claims: async (query: AdminClaimsQuery): Promise<PageDto<ClaimDto>> =>
    (await axiosClient.get<PageDto<ClaimDto>>('/api/admin/claims', { params: query })).data,
  claim: async (id: string): Promise<ClaimDto> => (await axiosClient.get<{ claim: ClaimDto }>(`/api/admin/claims/${id}`)).data.claim,
  updateClaim: async (id: string, payload: AdminClaimUpdatePayload): Promise<ClaimDto> =>
    (await axiosClient.patch<{ claim: ClaimDto }>(`/api/admin/claims/${id}`, payload)).data.claim,
  reviews: async (query: AdminReviewsQuery): Promise<PageDto<ReviewDto>> =>
    (await axiosClient.get<PageDto<ReviewDto>>('/api/admin/reviews', { params: query })).data,
  moderateReview: async (id: string, status: ReviewStatus, note?: string): Promise<ReviewDto> =>
    (await axiosClient.patch<{ review: ReviewDto }>(`/api/admin/reviews/${id}`, { status, note })).data.review,
};
