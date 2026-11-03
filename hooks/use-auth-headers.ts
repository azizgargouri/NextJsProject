'use client';

import { useAuthStore } from '@/hooks/stores/auth-store';

/**
 * AI SDK hooks use fetch (not our Axios instance), so the bearer token is passed explicitly.
 * If it has expired, the AI routes fall back to the httpOnly refresh cookie on the server.
 */
export function useAuthHeaders(): Record<string, string> {
  const token = useAuthStore((state) => state.accessToken);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
