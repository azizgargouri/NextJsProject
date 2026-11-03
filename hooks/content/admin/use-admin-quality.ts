import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AdminClaimUpdatePayload,
  AdminClaimsQuery,
  AdminReviewsQuery,
  ReviewStatus,
} from '@/types';

/** Server state for the disputes desk and review moderation (TanStack Query). */
export function useAdminQuality() {
  return useQuery({ queryKey: ['admin', 'quality'], queryFn: api.admin.quality });
}

export function useAdminClaims(query: AdminClaimsQuery) {
  return useQuery({
    queryKey: ['admin', 'claims', query],
    queryFn: () => api.admin.claims(query),
    placeholderData: (previous) => previous,
  });
}

export function useAdminClaim(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'claims', 'detail', id],
    queryFn: () => api.admin.claim(id!),
    enabled: Boolean(id),
  });
}

export function useClaimUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdminClaimUpdatePayload }) =>
      api.admin.updateClaim(id, payload),
    onSuccess: async (claim) => {
      queryClient.setQueryData(['admin', 'claims', 'detail', claim.id], claim);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'claims'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'quality'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] }),
      ]);
    },
  });
}

export function useAdminReviews(query: AdminReviewsQuery) {
  return useQuery({
    queryKey: ['admin', 'reviews', query],
    queryFn: () => api.admin.reviews(query),
    placeholderData: (previous) => previous,
  });
}

export function useReviewModeration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: ReviewStatus; note?: string }) =>
      api.admin.moderateReview(id, status, note),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'quality'] }),
      ]);
    },
  });
}
