import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AdminPricingQuery, PricingRuleDto } from '@/types';

export function useAdminPricing(query: AdminPricingQuery) {
  return useQuery({
    queryKey: ['admin', 'pricing', query],
    queryFn: () => api.admin.pricing(query),
    placeholderData: (previous) => previous,
  });
}

export type { PricingRuleDto };
