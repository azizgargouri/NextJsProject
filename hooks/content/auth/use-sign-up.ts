import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/hooks/stores/auth-store';
import type { SignUpPayload } from '@/lib/api/auth';

/** Sign-up mutation: on success, tokens are synced into the Zustand auth store. */
export function useSignUp() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: (payload: SignUpPayload) => api.auth.signUp(payload),
    onSuccess: (response) => {
      setSession(response.user, response.accessToken);
    },
  });
}
