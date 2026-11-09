import { authApi } from './auth';
import { attendanceApi } from './attendance';
import { contractsApi } from './contracts';
import { crewsApi } from './crews';
import { employeesApi } from './employees';
import { leaveRequestsApi } from './leave-requests';
import { reportsApi } from './reports';
import { trackingApi } from './tracking';
import { voiceApi } from './voice';
import { axiosClient } from './client';

/** API barrel endpoint (replicates `instanct-ui/src/api` with the Object.freeze directive). */
export const api = Object.freeze({
  auth: authApi,
  employees: employeesApi,
  contracts: contractsApi,
  attendance: attendanceApi,
  leaveRequests: leaveRequestsApi,
  reports: reportsApi,
  crews: crewsApi,
  tracking: trackingApi,
  voice: voiceApi,
});

export { axiosClient };
