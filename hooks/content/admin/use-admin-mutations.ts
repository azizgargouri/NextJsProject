import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ContentResetPayload, ContentSavePayload, PricingRulePayload } from '@/types';

function useInvalidateAdminData() {
  const queryClient = useQueryClient();
  return async (locale?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] }),
      locale
        ? queryClient.invalidateQueries({ queryKey: ['admin', 'content', locale] })
        : queryClient.invalidateQueries({ queryKey: ['admin', 'content'] }),
    ]);
  };
}

export function useCreatePricingRule() {
  const invalidate = useInvalidateAdminData();
  return useMutation({
    mutationFn: (payload: PricingRulePayload) => api.admin.createPricingRule(payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdatePricingRule() {
  const invalidate = useInvalidateAdminData();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<PricingRulePayload> }) =>
      api.admin.updatePricingRule(id, payload),
    onSuccess: () => invalidate(),
  });
}

export function useDeletePricingRule() {
  const invalidate = useInvalidateAdminData();
  return useMutation({
    mutationFn: (id: string) => api.admin.deletePricingRule(id),
    onSuccess: () => invalidate(),
  });
}

export function useSaveContent() {
  const invalidate = useInvalidateAdminData();
  return useMutation({
    mutationFn: (payload: ContentSavePayload) => api.admin.saveContent(payload),
    onSuccess: (_data, variables) => invalidate(variables.locale),
  });
}

export function useResetContent() {
  const invalidate = useInvalidateAdminData();
  return useMutation({
    mutationFn: (payload: ContentResetPayload) => api.admin.resetContent(payload),
    onSuccess: (_data, variables) => invalidate(variables.locale),
  });
}
