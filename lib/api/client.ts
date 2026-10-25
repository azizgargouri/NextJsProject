import axios, { type AxiosError, type AxiosInstance } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

export const REFRESH_COOKIE = 'moveup_refresh';

const authEndpoints = ['/api/auth/sign-in', '/api/auth/sign-up', '/api/auth/sign-out'] as const;

/** Single Axios instance replicating instanct-ui's api client: language + auth headers, one-shot 401 refresh. */
export const axiosClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15000,
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await axios.post<{ accessToken: string }>(
      `${BASE_URL}/api/auth/refresh-token`,
      {},
      { withCredentials: true },
    );
    const { useAuthStore } = await import('@/hooks/stores/auth-store');
    useAuthStore.getState().setAccessToken(response.data.accessToken);
    return response.data.accessToken;
  } catch {
    const { useAuthStore } = await import('@/hooks/stores/auth-store');
    useAuthStore.getState().logout();
    return null;
  }
}

axiosClient.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    const { useAuthStore } = await import('@/hooks/stores/auth-store');
    const token = useAuthStore.getState().accessToken;

    if (token && !authEndpoints.some((endpoint) => config.url?.includes(endpoint))) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      (NonNullable<AxiosError['config']> & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;

      refreshing = refreshing ?? refreshAccessToken();
      const token = await refreshing;
      refreshing = null;

      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return axiosClient(original);
      }
    }

    return Promise.reject(error);
  },
);
