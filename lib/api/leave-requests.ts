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
  create: async (payload: CreateLeavePayload): Promise<LeaveRequestDto> => {
    const { data } = await axiosClient.post<{ leaveRequest: LeaveRequestDto }>(
      '/api/leave-requests',
      payload,
    );
    return data.leaveRequest;
  },
  decide: async (id: string, status: 'approved' | 'rejected'): Promise<LeaveRequestDto> => {
    const { data } = await axiosClient.patch<{ leaveRequest: LeaveRequestDto }>(
      `/api/leave-requests/${id}`,
      { status },
    );
    return data.leaveRequest;
  },
};
