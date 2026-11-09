import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PlaygroundModuleKey } from '@/types';

export function useAdminPlayground() {
  return useQuery({
    queryKey: ['admin', 'playground'],
    queryFn: () => api.admin.playground(),
  });
}

/** Seeds (some or all modules) or resets; every admin list may change afterwards. */
export function useRunPlayground() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      payload: { action: 'seed'; modules?: PlaygroundModuleKey[] } | { action: 'reset' },
    ) => api.admin.runPlayground(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin', 'playground'], data);
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}
