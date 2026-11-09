import { useAuthStore } from '@/hooks/stores/auth-store';
import type { MoverActionResult } from '@/types';

/** A Server Action's refusal, with the message the server wants the mover to read. */
export class MoverActionError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'MoverActionError';
    this.code = code;
  }
}

/** Turns an action result into a value or a thrown error, for React Query mutations. */
export async function callMoverAction<T>(action: Promise<MoverActionResult<T>>): Promise<T> {
  const result = await action;
  if (result.ok) return result.data;
  // The session cookie is gone or revoked: the shell's guard sends them to sign in.
  if (result.code === 'UNAUTHORIZED') useAuthStore.getState().logout();
  throw new MoverActionError(result.message, result.code);
}
