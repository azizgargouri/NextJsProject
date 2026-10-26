import { axiosClient } from './client';
import type { AttendanceDto, CheckInPayload, CheckInResponse } from '@/types';

export interface AttendanceQueryParams {
  date?: string;
  from?: string;
  to?: string;
  employeeRef?: string;
}

/** Attendance endpoints — range reads (JWT-scoped) and the geolocated check-in. */
export const attendanceApi = {
  list: async (params: AttendanceQueryParams = {}): Promise<AttendanceDto[]> => {
    const { data } = await axiosClient.get<{ attendance: AttendanceDto[] }>('/api/attendance', {
      params,
    });
    return data.attendance;
  },
  checkIn: async (payload: CheckInPayload): Promise<CheckInResponse> => {
    const { data } = await axiosClient.post<CheckInResponse>('/api/attendance/checkin', payload);
    return data;
  },
};
