import { axiosClient } from './client';
import type {
  AdminAuditQuery,
  AdminOverviewDto,
  AdminUserCreatePayload,
  AdminUserUpdatePayload,
  AdminUsersQuery,
  AuditEventDto,
  PageDto,
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
};
