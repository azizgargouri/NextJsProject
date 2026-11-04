import { useQuery } from '@tanstack/react-query';
import { homesApi } from '@/lib/api/homes';
import { homesKeys, useHomesUserId } from './use-homes';

export function useHome(id: string) {
  const userId = useHomesUserId();
  return useQuery({
    queryKey: homesKeys.detail(userId, id),
    queryFn: () => homesApi.get(id),
    enabled: Boolean(id),
  });
}
