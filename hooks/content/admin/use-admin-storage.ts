import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { StorageObjectsQuery } from '@/types';

export function useAdminStorageStatus() {
  return useQuery({
    queryKey: ['admin', 'storage', 'status'],
    queryFn: () => api.admin.storageStatus(),
  });
}

export function useAdminStorageObjects(query: StorageObjectsQuery) {
  return useQuery({
    queryKey: ['admin', 'storage', 'objects', query],
    queryFn: () => api.admin.storageObjects(query),
    placeholderData: (previous) => previous,
  });
}

export function useDeleteStorageObject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.admin.deleteStorageObject(key),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'storage'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] }),
        result.detachedUserId
          ? queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
          : Promise.resolve(),
      ]);
    },
  });
}
