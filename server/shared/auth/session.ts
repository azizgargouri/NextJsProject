import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AccessTokenPayload } from './jwt';
import { sha256Hex } from './jwt';
import { getCurrentUser } from './guards';
import { ForbiddenError, UnauthorizedError } from '../database/errors';
import { AuthRepository } from '../../modules/auth/auth.repository';
import { UserRepository } from '../../modules/users/users.repository';
import type { Role } from '../database/enums';

/** Same cookie the auth controller sets on sign-in (httpOnly, sameSite=lax, path=/). */
export const REFRESH_COOKIE = 'moveup_refresh';

/** Identity resolved from current database truth (role / status never trusted from the client). */
export interface SessionUser {
  sub: string;
  email: string;
  name: string;
  role: Role;
}

async function loadActiveUser(userId: string): Promise<SessionUser> {
  const stored = await new UserRepository().findOneById(userId);
  if (!stored || stored.deletedAt) throw new UnauthorizedError();
  if (stored.status === 'BLOCKED') throw new ForbiddenError('Account is blocked');
  return { sub: stored.id, email: stored.email, name: stored.name, role: stored.role };
}

/**
 * Resolves the user from the httpOnly refresh cookie WITHOUT rotating it.
 * Used where no bearer header exists: Server Actions (course ch.5) and
 * streaming AI routes whose access token may have expired mid-conversation.
 * sameSite=lax keeps the cookie off cross-site POSTs (CSRF protection).
 */
async function userFromRefreshCookie(): Promise<SessionUser | null> {
  const raw = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (!raw) return null;
  const stored = await new AuthRepository().findValidByTokenHash(sha256Hex(raw));
  if (!stored) return null;
  return loadActiveUser(stored.userId);
}

/** Guard for Server Actions: cookie session + role check. */
export async function requireActionUser(allowed?: readonly Role[]): Promise<SessionUser> {
  const user = await userFromRefreshCookie();
  if (!user) throw new UnauthorizedError('Your session expired — sign in again');
  if (allowed && !allowed.includes(user.role)) throw new ForbiddenError();
  return user;
}

/**
 * Guard for route handlers that may be called by AI SDK hooks (fetch, not Axios):
 * bearer token first, refresh cookie as a fallback.
 */
export async function requireSessionUser(
  request: Request,
  allowed?: readonly Role[],
): Promise<SessionUser> {
  const token: AccessTokenPayload | null = await getCurrentUser(request);
  const user = token ? await loadActiveUser(token.sub) : await userFromRefreshCookie();
  if (!user) throw new UnauthorizedError();
  if (allowed && !allowed.includes(user.role)) throw new ForbiddenError();
  return user;
}

/** For Server Components: the signed-in user, or null (the page then redirects to /sign-in). */
export async function getPageUser(): Promise<SessionUser | null> {
  try {
    return await userFromRefreshCookie();
  } catch {
    return null;
  }
}

/** Server Component guard: redirects instead of throwing (sign-in, or the admin desk for staff). */
export async function requirePageUser(allowed?: readonly Role[]): Promise<SessionUser> {
  const user = await getPageUser();
  if (!user) redirect('/sign-in');
  if (user.role === 'ADMIN') redirect('/admin');
  if (allowed && !allowed.includes(user.role)) redirect('/dashboard');
  return user;
}
