import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/hooks/stores/auth-store';

/** Sign-out mutation: clears the client session after the server revokes tokens. */
export function useSignOut() {
  const logout = useAuthStore((state) => state.logout);

  return useMutation({
    mutationFn: async () => {
      await api.auth.signOut();
      logout();
    },
  });
}
