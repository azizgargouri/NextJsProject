import { useMutation, useQueryClient } from '@tanstack/react-query';
import { homesApi } from '@/lib/api/homes';
import type { HomeDto, HomePayload, RoomPayload } from '@/types/homes';
import { homesKeys, useHomesUserId } from './use-homes';

/** Every house/room mutation returns the full house: cache it, then refresh the lists. */
function useSyncHome() {
  const queryClient = useQueryClient();
  const userId = useHomesUserId();
  return async (home: HomeDto) => {
    queryClient.setQueryData(homesKeys.detail(userId, home.id), home);
    await queryClient.invalidateQueries({ queryKey: homesKeys.lists(userId) });
  };
}

export function useCreateHome() {
  const sync = useSyncHome();
  return useMutation({
    mutationFn: (payload: HomePayload) => homesApi.create(payload),
    onSuccess: sync,
  });
}

export function useUpdateHome(id: string) {
  const sync = useSyncHome();
  return useMutation({
    mutationFn: (payload: Partial<HomePayload>) => homesApi.update(id, payload),
    onSuccess: sync,
  });
}

export function useDeleteHome(id: string) {
  const queryClient = useQueryClient();
  const userId = useHomesUserId();
  return useMutation({
    mutationFn: () => homesApi.remove(id),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: homesKeys.detail(userId, id) });
      await queryClient.invalidateQueries({ queryKey: homesKeys.lists(userId) });
    },
  });
}

export function useAddRoom(homeId: string) {
  const sync = useSyncHome();
  return useMutation({
    mutationFn: (payload: RoomPayload) => homesApi.addRoom(homeId, payload),
    onSuccess: sync,
  });
}

export function useUpdateRoom(homeId: string) {
  const sync = useSyncHome();
  return useMutation({
    mutationFn: ({ roomId, payload }: { roomId: string; payload: RoomPayload }) =>
      homesApi.updateRoom(homeId, roomId, payload),
    onSuccess: sync,
  });
}

export function useRemoveRoom(homeId: string) {
  const sync = useSyncHome();
  return useMutation({
    mutationFn: (roomId: string) => homesApi.removeRoom(homeId, roomId),
    onSuccess: sync,
  });
}
