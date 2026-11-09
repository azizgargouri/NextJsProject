import type { z } from 'zod';
import { verifyAccessToken, type AccessTokenPayload } from '../shared/auth/jwt';
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
  toErrorBody,
} from '../shared/database/errors';
import type { ActionResult } from '@/lib/actions/result';

/**
 * Resolves the session for a server action. The app keeps its access token in
 * the client auth store (and sends it to the REST API as a bearer header), so
 * client adapters forward that same token here. Authentication endpoints stay
 * untouched; this only re-verifies the JWT before a write reaches Mongo.
 */
export async function requireActionUser(
  accessToken: string | null | undefined,
  options: { admin?: boolean } = {},
): Promise<AccessTokenPayload> {
  if (!accessToken) throw new UnauthorizedError();

  let user: AccessTokenPayload;
  try {
    user = await verifyAccessToken(accessToken);
  } catch {
    throw new UnauthorizedError('Session expired. Please sign in again.');
  }

  if (options.admin && user.role !== 'ADMIN') {
    throw new ForbiddenError('Admin access required');
  }

  return user;
}

/** Runtime validation for every server-action payload. */
export function parseActionPayload<S extends z.ZodType>(
  schema: S,
  payload: unknown,
): z.output<S> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }
  return parsed.data;
}

/** Runs a write and converts thrown domain errors into the serializable envelope. */
export async function runAction<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    const { status, body } = toErrorBody(error);

    if (status >= 500) {
      console.error('[server-action]', error);
    }

    return {
      ok: false,
      error: {
        status,
        code: body.code,
        message: body.message,
        ...(body.details !== undefined ? { details: body.details } : {}),
      },
    };
  }
}
