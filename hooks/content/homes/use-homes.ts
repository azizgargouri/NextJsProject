import { useQuery } from '@tanstack/react-query';
import { homesApi } from '@/lib/api/homes';
import { useAuthStore } from '@/hooks/stores/auth-store';
import type { HomesQuery } from '@/types/homes';

/**
 * Keys are scoped to the signed-in user: sign-out does not clear the React
 * Query cache, so a second account on the same browser must never be served
 * the first account's cached houses.
 */
export const homesKeys = {
  all: (userId: string) => ['homes', userId] as const,
  lists: (userId: string) => ['homes', userId, 'list'] as const,
  list: (userId: string, query: HomesQuery) => ['homes', userId, 'list', query] as const,
  detail: (userId: string, id: string) => ['homes', userId, 'detail', id] as const,
  moveRequests: (userId: string) => ['homes', userId, 'move-requests'] as const,
  layout: (userId: string, homeId: string) => ['homes', userId, 'layout', homeId] as const,
};

export function useHomesUserId(): string {
  return useAuthStore((state) => state.user?.id ?? 'anonymous');
}

export function useHomes(query: HomesQuery) {
  const userId = useHomesUserId();
  return useQuery({
    queryKey: homesKeys.list(userId, query),
    queryFn: () => homesApi.list(query),
    placeholderData: (previous) => previous,
  });
}

/** The client's move requests (link picker), with the house each one is linked to. */
export function useClientMoveRequests() {
  const userId = useHomesUserId();
  return useQuery({
    queryKey: homesKeys.moveRequests(userId),
    queryFn: () => homesApi.moveRequests(),
  });
}
