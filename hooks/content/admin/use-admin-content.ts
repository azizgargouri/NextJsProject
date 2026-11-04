import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ContentBundleDto } from '@/types';

export function useAdminContent(locale: ContentBundleDto['locale']) {
  return useQuery({
    queryKey: ['admin', 'content', locale],
    queryFn: () => api.admin.content(locale),
    placeholderData: (previous) => previous,
  });
}
