import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AttendanceQueryParams } from '@/lib/api/attendance';
import type { CheckInPayload } from '@/types';

/** Attendance rows for a day / range (defaults to today server-side). */
export function useAttendance(params: AttendanceQueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: ['attendance', params],
    queryFn: () => api.attendance.list(params),
    enabled,
  });
}

/** Geolocated check-in — refreshes today's rows on success. */
export function useCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CheckInPayload) => api.attendance.checkIn(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });
}
