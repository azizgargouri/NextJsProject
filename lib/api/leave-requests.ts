import {
  createLeaveRequestAction,
  decideLeaveRequestAction,
} from '@/app/actions/hr';
import { actionAccessToken, unwrapActionResult } from '@/lib/actions/client';
import { axiosClient } from './client';
import type { LeaveRequestDto, LeaveStatus, LeaveType } from '@/types';

export interface LeaveQueryParams {
  status?: LeaveStatus;
  employeeRef?: string;
}

export interface CreateLeavePayload {
  type: LeaveType;
  startDate: string;
  endDate: string;
  daysRequested?: number;
  reason?: string;
}

/** Leave-request endpoints — submissions come from the session's own profile. */
export const leaveRequestsApi = {
  list: async (params: LeaveQueryParams = {}): Promise<LeaveRequestDto[]> => {
    const { data } = await axiosClient.get<{ leaveRequests: LeaveRequestDto[] }>(
      '/api/leave-requests',
      { params },
    );
    return data.leaveRequests;
  },
  create: async (payload: CreateLeavePayload): Promise<LeaveRequestDto> =>
    unwrapActionResult(await createLeaveRequestAction(actionAccessToken(), payload)),
  decide: async (id: string, status: 'approved' | 'rejected'): Promise<LeaveRequestDto> =>
    unwrapActionResult(
      await decideLeaveRequestAction(actionAccessToken(), id, { status }),
    ),
};
