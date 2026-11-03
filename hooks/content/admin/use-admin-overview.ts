import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: api.admin.overview,
    staleTime: 30_000,
  });
}
