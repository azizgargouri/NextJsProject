import { axiosClient } from './client';
import type {
  AccountNotificationsPage,
  AccountSessionDto,
  PasswordChangePayload,
  ProfileUpdatePayload,
  ResponseUserDto,
} from '@/types';

/** Self-service endpoints for the signed-in user (any role). */
export const accountApi = {
  profile: async (): Promise<ResponseUserDto> => {
    const { data } = await axiosClient.get<{ user: ResponseUserDto }>('/api/account/profile');
    return data.user;
  },

  updateProfile: async (payload: ProfileUpdatePayload): Promise<ResponseUserDto> => {
    const { data } = await axiosClient.patch<{ user: ResponseUserDto }>(
      '/api/account/profile',
      payload,
    );
    return data.user;
  },

  uploadAvatar: async (file: File): Promise<ResponseUserDto> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await axiosClient.post<{ user: ResponseUserDto }>(
      '/api/account/avatar',
      form,
      { timeout: 60000 },
    );
    return data.user;
  },

  removeAvatar: async (): Promise<ResponseUserDto> => {
    const { data } = await axiosClient.delete<{ user: ResponseUserDto }>('/api/account/avatar');
    return data.user;
  },

  changePassword: async (payload: PasswordChangePayload): Promise<{ revokedSessions: number }> => {
    const { data } = await axiosClient.patch<{ revokedSessions: number }>(
      '/api/account/password',
      payload,
    );
    return data;
  },

  sessions: async (): Promise<AccountSessionDto[]> => {
    const { data } = await axiosClient.get<{ sessions: AccountSessionDto[] }>(
      '/api/account/sessions',
    );
    return data.sessions;
  },

  revokeSession: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/account/sessions/${id}`);
  },

  revokeOtherSessions: async (): Promise<{ revoked: number }> => {
    const { data } = await axiosClient.delete<{ revoked: number }>('/api/account/sessions');
    return data;
  },

  notifications: async (query: {
    limit?: number;
    before?: string;
  }): Promise<AccountNotificationsPage> => {
    const { data } = await axiosClient.get<AccountNotificationsPage>('/api/account/notifications', {
      params: query,
    });
    return data;
  },

  markNotificationsRead: async (): Promise<{ seenAt: string }> => {
    const { data } = await axiosClient.post<{ seenAt: string }>(
      '/api/account/notifications/read',
      {},
    );
    return data;
  },
};
