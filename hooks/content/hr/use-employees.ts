import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CreateEmployeePayload, UpdateEmployeePayload } from '@/lib/api/employees';

/** Directory of the signed-in admin's organisation. */
export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: () => api.employees.list(),
  });
}

/** Employee profile linked to the signed-in account (null when none). */
export function useMyEmployee() {
  return useQuery({
    queryKey: ['employees', 'me'],
    queryFn: () => api.employees.me(),
  });
}

/** Adds a staff member — refreshes the directory afterwards. */
export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateEmployeePayload) => api.employees.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}

/** Inline directory edits (name / email / role / status). */
export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEmployeePayload }) =>
      api.employees.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}
