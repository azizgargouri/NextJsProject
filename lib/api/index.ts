import { authApi } from './auth';
import { attendanceApi } from './attendance';
import { employeesApi } from './employees';
import { leaveRequestsApi } from './leave-requests';
import { reportsApi } from './reports';
import { movesApi } from './moves';
import { axiosClient, ensureAccessToken } from './client';

/** API barrel endpoint (replicates `instanct-ui/src/api` with the Object.freeze directive). */
export const api = Object.freeze({
  auth: authApi,
  employees: employeesApi,
  attendance: attendanceApi,
  leaveRequests: leaveRequestsApi,
  reports: reportsApi,
  moves: movesApi,
});

export { axiosClient, ensureAccessToken };
