import { NextResponse } from 'next/server';
import { verifyAccessToken, type AccessTokenPayload } from './jwt';
import { ForbiddenError, UnauthorizedError, toErrorBody } from '../database/errors';

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
  const user = await getCurrentUser(request);
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * Guard for the RH / employee-tracking admin surface (dashboard, directory,
 * attendance, leave decisions). Replaces the local module's role check.
 */
export async function requireAdmin(request: Request): Promise<AccessTokenPayload> {
  const user = await requireAuth(request);
  if (user.role !== 'ADMIN') throw new ForbiddenError('Admin access required');
  return user;
}

/** Normalizes any thrown error into a typed NextResponse (central error handler). */
export function errorResponse(error: unknown): NextResponse {
  const { status, body } = toErrorBody(error);
  return NextResponse.json(body, { status });
}
