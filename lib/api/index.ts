import { authApi } from './auth';
import { adminApi } from './admin';
import { attendanceApi } from './attendance';
import { employeesApi } from './employees';
import { leaveRequestsApi } from './leave-requests';
import { reportsApi } from './reports';
import { movesApi } from './moves';
import { homesApi } from './homes';
import { contractsApi } from './contracts';
import { crewsApi } from './crews';
import { trackingApi } from './tracking';
import { voiceApi } from './voice';
import { axiosClient, ensureAccessToken } from './client';

/** API barrel endpoint (replicates `instanct-ui/src/api` with the Object.freeze directive). */
export const api = Object.freeze({
  auth: authApi,
  admin: adminApi,
  employees: employeesApi,
  attendance: attendanceApi,
  leaveRequests: leaveRequestsApi,
  reports: reportsApi,
  moves: movesApi,
  homes: homesApi,
  contracts: contractsApi,
  crews: crewsApi,
  tracking: trackingApi,
  voice: voiceApi,
});

export { axiosClient, ensureAccessToken };
