import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DashboardStatsParams } from '@/lib/api/reports';

/** HR overview numbers behind the dashboard tiles. */
export function useDashboardStats(params: DashboardStatsParams = {}) {
  return useQuery({
    queryKey: ['dashboard-stats', params],
    queryFn: () => api.reports.dashboardStats(params),
  });
}
