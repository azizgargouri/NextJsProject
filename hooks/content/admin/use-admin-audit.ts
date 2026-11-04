import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AdminAuditQuery } from '@/types';

export function useAdminAudit(query: AdminAuditQuery) {
  return useQuery({
    queryKey: ['admin', 'audit', query],
    queryFn: () => api.admin.audit(query),
    placeholderData: (previous) => previous,
  });
}
