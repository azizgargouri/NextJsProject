import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CreateLeavePayload, LeaveQueryParams } from '@/lib/api/leave-requests';

/** Leave requests in the caller's scope (org-wide for admins, own for employees). */
export function useLeaveRequests(params: LeaveQueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: ['leave-requests', params],
    queryFn: () => api.leaveRequests.list(params),
    enabled,
  });
}

/** Submits a leave request for the session's own profile. */
export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateLeavePayload) => api.leaveRequests.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave-requests'] }),
  });
}

/** HR approve / reject decision. */
export function useDecideLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      api.leaveRequests.decide(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}
