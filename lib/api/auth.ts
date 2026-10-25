import { axiosClient } from './client';
import type { ApiUserResponse, ResponseUserDto } from '@/types';

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SignUpPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: 'CLIENT' | 'MOVER';
  locale?: 'en' | 'fr' | 'ar';
}

/** Auth endpoints organized by domain, exposed as the `api` barrel (instanct-ui pattern). */
export const authApi = {
  signIn: async (payload: SignInPayload): Promise<ApiUserResponse> => {
    const { data } = await axiosClient.post<ApiUserResponse>('/api/auth/sign-in', payload);
    return data;
  },
  signUp: async (payload: SignUpPayload): Promise<ApiUserResponse> => {
    const { data } = await axiosClient.post<ApiUserResponse>('/api/auth/sign-up', payload);
    return data;
  },
  signOut: async (): Promise<void> => {
    await axiosClient.post('/api/auth/sign-out', {});
  },
  me: async (): Promise<ResponseUserDto> => {
    const { data } = await axiosClient.get<{ user: ResponseUserDto }>('/api/auth/me');
    return data.user;
  },
};
