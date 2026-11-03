import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/hooks/stores/auth-store';

/** Sign-out mutation: clears the client session after the server revokes tokens. */
export function useSignOut() {
  const logout = useAuthStore((state) => state.logout);

  return useMutation({
    mutationFn: async () => {
      // Local sign-out must remain available even when the API is unreachable.
      await api.auth.signOut().catch(() => undefined);
      logout();
    },
  });
}
