import { NextResponse } from 'next/server';
import { verifyAccessToken, type AccessTokenPayload } from './jwt';
import { ForbiddenError, UnauthorizedError, toErrorBody } from '../database/errors';
import { UserRepository } from '../../modules/users/users.repository';

/** Extracts and verifies the bearer access token (replaces @InjectAccessTokenPayload). */
export async function getCurrentUser(request: Request): Promise<AccessTokenPayload | null> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;

  try {
    return await verifyAccessToken(header.slice(7));
  } catch {
    return null;
  }
}

/** Guard for protected handlers (replaces AuthGuard / @Public). */
export async function requireAuth(request: Request): Promise<AccessTokenPayload> {
  const tokenUser = await getCurrentUser(request);
  if (tokenUser) {
    const storedUser = await new UserRepository().findOneById(tokenUser.sub);
    if (!storedUser || storedUser.deletedAt) throw new UnauthorizedError();
    if (storedUser.status === 'BLOCKED') throw new ForbiddenError('Account is blocked');

    // Roles and email come from current database truth, not a possibly stale token.
    return { ...tokenUser, email: storedUser.email, role: storedUser.role };
  }

  // Fallback to httpOnly session cookie if Bearer header is missing (e.g. page refresh / fetch calls)
  try {
    const { userFromRefreshCookie } = await import('./session');
    const session = await userFromRefreshCookie();
    if (session) {
      const nowSec = Math.floor(Date.now() / 1000);
      return {
        sub: session.sub,
        email: session.email,
        role: session.role,
        iat: nowSec,
        exp: nowSec + 3600,
      };
    }
  } catch {
    // Fall through to UnauthorizedError
  }

  throw new UnauthorizedError();
}

/** Enforces a verified role at the HTTP boundary; services never trust client state. */
export async function requireRole(
  request: Request,
  allowedRoles: readonly AccessTokenPayload['role'][],
): Promise<AccessTokenPayload> {
  const user = await requireAuth(request);
  if (!allowedRoles.includes(user.role)) throw new ForbiddenError();
  return user;
}

export function requireAdmin(request: Request): Promise<AccessTokenPayload> {
  return requireRole(request, ['ADMIN']);
}

/** Normalizes any thrown error into a typed NextResponse (central error handler). */
export function errorResponse(error: unknown): NextResponse {
  const { status, body } = toErrorBody(error);
  return NextResponse.json(body, { status });
}
