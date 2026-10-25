import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/hooks/stores/auth-store';
import type { SignInPayload } from '@/lib/api/auth';

/** Sign-in mutation: on success, tokens are synced into the Zustand auth store. */
export function useSignIn() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: (payload: SignInPayload) => api.auth.signIn(payload),
    onSuccess: (response) => {
      setSession(response.user, response.accessToken);
    },
  });
}
