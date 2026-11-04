import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AdminUsersQuery } from '@/types';

export function useAdminUsers(query: AdminUsersQuery) {
  return useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: () => api.admin.users(query),
    placeholderData: (previous) => previous,
  });
}
