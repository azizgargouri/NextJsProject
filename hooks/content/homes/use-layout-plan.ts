import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { homesApi } from '@/lib/api/homes';
import type { LayoutItemUpdatePayload, LayoutPlanDto } from '@/types/homes';
import { homesKeys, useHomesUserId } from './use-homes';

/** Saved AI layout of a house (null = none yet). Re-read when the house changes. */
export function useLayoutPlan(homeId: string, houseVersion: string) {
  const userId = useHomesUserId();
  return useQuery({
    queryKey: [...homesKeys.layout(userId, homeId), houseVersion],
    queryFn: () => homesApi.layout(homeId),
    networkMode: 'offlineFirst',
    placeholderData: (previous) => previous,
  });
}

export function useGenerateLayout(homeId: string) {
  const queryClient = useQueryClient();
  const userId = useHomesUserId();
  return useMutation({
    mutationFn: () => homesApi.generateLayout(homeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: homesKeys.layout(userId, homeId) }),
  });
}

export function useDeleteLayout(homeId: string) {
  const queryClient = useQueryClient();
  const userId = useHomesUserId();
  return useMutation({
    mutationFn: () => homesApi.deleteLayout(homeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: homesKeys.layout(userId, homeId) }),
  });
}

/** Move / rotate / take out one item; the returned plan replaces the cached one. */
export function useUpdateLayoutItem(homeId: string) {
  const queryClient = useQueryClient();
  const userId = useHomesUserId();
  return useMutation({
    mutationFn: (payload: LayoutItemUpdatePayload) => homesApi.updateLayoutItem(homeId, payload),
    onSuccess: (plan: LayoutPlanDto) =>
      queryClient.setQueriesData({ queryKey: homesKeys.layout(userId, homeId) }, plan),
  });
}
