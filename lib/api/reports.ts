import { axiosClient } from './client';
import type { DashboardStatsDto, EmployeeStatus } from '@/types';

export interface DashboardStatsParams {
  from?: string;
  to?: string;
  status?: EmployeeStatus;
}

/** Reports endpoints — HR overview numbers behind the dashboard tiles. */
export const reportsApi = {
  dashboardStats: async (params: DashboardStatsParams = {}): Promise<DashboardStatsDto> => {
    const { data } = await axiosClient.get<{ stats: DashboardStatsDto }>('/api/reports/dashboard', {
      params,
    });
    return data.stats;
  },
};
