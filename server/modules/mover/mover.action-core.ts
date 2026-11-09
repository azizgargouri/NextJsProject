import { AuthRepository } from '../auth/auth.repository';
import { sha256Hex } from '../../shared/auth/jwt';
import { DomainError, ForbiddenError, UnauthorizedError } from '../../shared/database/errors';
import type { MoverActionResult } from '../../../types/mover';
import { moverRepository } from './mover.repository';

/** The httpOnly session cookie set at sign-in. Server Actions get no bearer header. */
export const MOVER_SESSION_COOKIE = 'moveup_refresh';

/**
 * Applies the same rules as the API routes: a live session, an active account,
 * the MOVER role read from the database, and an approved application (M-02).
 */
export async function requireApprovedMoverFromCookie(rawToken: string | null): Promise<string> {
  if (!rawToken) throw new UnauthorizedError();
  const session = await new AuthRepository().findValidByTokenHash(sha256Hex(rawToken));
  if (!session) throw new UnauthorizedError();

  const user = await moverRepository.findUser(session.userId);
  if (!user) throw new UnauthorizedError();
  if (user.status === 'BLOCKED') throw new ForbiddenError('Account is blocked');
  if (user.role !== 'MOVER') throw new ForbiddenError();

  const profile = await moverRepository.findProfile(session.userId);
  if (profile?.verificationStatus !== 'APPROVED') {
    throw new ForbiddenError('Your mover application has not been approved');
  }
  return session.userId;
}

/**
 * Errors thrown across a Server Action lose their message in production, so
 * every outcome comes back as a plain value. Unknown errors never reach the browser.
 */
export async function runMoverAction<T>(
  rawToken: string | null,
  work: (moverId: string) => Promise<T>,
): Promise<MoverActionResult<T>> {
  try {
    const moverId = await requireApprovedMoverFromCookie(rawToken);
    return { ok: true, data: await work(moverId) };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, message: error.message, code: error.code };
    }
    console.error('[mover action]', error);
    return {
      ok: false,
      message: 'Something went wrong. Try again.',
      code: 'INTERNAL_SERVER_ERROR',
    };
  }
}
