'use client';

import { useAuthStore } from '@/hooks/stores/auth-store';
import { ActionError, type ActionResult } from './result';

/** Current access token, forwarded so actions can guard the Mongo write. */
export function actionAccessToken(): string {
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    throw new ActionError({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Your session has expired. Please sign in again.',
    });
  }
  return token;
}

/** Converts a failed action envelope back into a normal thrown error for hooks/UI. */
export async function unwrapActionResult<T>(
  result: ActionResult<T>,
): Promise<T> {
  if (result.ok) return result.data;
  throw new ActionError(result.error);
}
