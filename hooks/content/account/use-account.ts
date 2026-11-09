import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/hooks/stores/auth-store';
import type { PasswordChangePayload, ProfileUpdatePayload, ResponseUserDto } from '@/types';

const ACCOUNT_KEY = ['account'] as const;

/** Keeps the persisted session user (header, menus) in step with server truth. */
function useSyncSessionUser() {
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const queryClient = useQueryClient();
  return (user: ResponseUserDto) => {
    updateProfile({
      name: user.name,
      phone: user.phone,
      locale: user.locale,
      avatarUrl: user.avatarUrl,
    });
    queryClient.setQueryData([...ACCOUNT_KEY, 'profile'], user);
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  };
}

export function useAccountProfile() {
  const sync = useSyncSessionUser();
  return useQuery({
    queryKey: [...ACCOUNT_KEY, 'profile'],
    queryFn: async () => {
      const user = await api.account.profile();
      sync(user);
      return user;
    },
  });
}

export function useUpdateProfile() {
  const sync = useSyncSessionUser();
  return useMutation({
    mutationFn: (payload: ProfileUpdatePayload) => api.account.updateProfile(payload),
    onSuccess: sync,
  });
}

export function useUploadAvatar() {
  const sync = useSyncSessionUser();
  return useMutation({
    mutationFn: (file: File) => api.account.uploadAvatar(file),
    onSuccess: sync,
  });
}

export function useRemoveAvatar() {
  const sync = useSyncSessionUser();
  return useMutation({
    mutationFn: () => api.account.removeAvatar(),
    onSuccess: sync,
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PasswordChangePayload) => api.account.changePassword(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...ACCOUNT_KEY, 'sessions'] }),
  });
}

export function useAccountSessions() {
  return useQuery({
    queryKey: [...ACCOUNT_KEY, 'sessions'],
    queryFn: () => api.account.sessions(),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.account.revokeSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...ACCOUNT_KEY, 'sessions'] }),
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.account.revokeOtherSessions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...ACCOUNT_KEY, 'sessions'] }),
  });
}

const NOTIFICATIONS_PAGE = 20;

export function useAccountNotifications() {
  return useInfiniteQuery({
    queryKey: [...ACCOUNT_KEY, 'notifications'],
    queryFn: ({ pageParam }) =>
      api.account.notifications({ limit: NOTIFICATIONS_PAGE, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  });
}

/** Lightweight unread probe for the header bell (refreshes every minute). */
export function useUnreadNotifications() {
  return useQuery({
    queryKey: [...ACCOUNT_KEY, 'notifications', 'unread'],
    queryFn: async () => (await api.account.notifications({ limit: 1 })).unreadCount,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.account.markNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...ACCOUNT_KEY, 'notifications'] }),
  });
}
