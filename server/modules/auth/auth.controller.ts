import { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { env } from '../../config/env';
import { errorResponse } from '../../shared/auth/guards';
import { logEvent, EventType } from '../../shared/logger/audit';
import { ValidationError } from '../../shared/database/errors';
import { authService } from './auth.service';
import { serializeAuthSession, type AuthSessionResponse } from './auth.serializer';
import { RefreshTokenSchema, SignInSchema, SignUpSchema } from './auth.schema';

const REFRESH_COOKIE = 'moveup_refresh';

/**
 * Auth controller — thin HTTP adapter: parse/validate (Zod), call service,
 * serialize response, map errors to HTTP. No business logic, no DB access.
 */
class AuthController {
  async signUp(request: NextRequest): Promise<NextResponse> {
    try {
      const input = await this.validate(request, SignUpSchema);
      const session = await authService.signUp(input);

      logEvent({
        event: EventType.SIGNUP,
        userId: session.user.id,
        method: 'POST',
        api: '/api/auth/sign-up',
      });

      return this.sessionResponse(request, session);
    } catch (error) {
      return errorResponse(error);
    }
  }

  async signIn(request: NextRequest): Promise<NextResponse> {
    try {
      const input = await this.validate(request, SignInSchema);
      const session = await authService.signIn(input);

      logEvent({
        event: EventType.SIGNIN,
        userId: session.user.id,
        method: 'POST',
        api: '/api/auth/sign-in',
      });

      return this.sessionResponse(request, session);
    } catch (error) {
      return errorResponse(error);
    }
  }

  async refreshToken(request: NextRequest): Promise<NextResponse> {
    try {
      // The httpOnly cookie is the primary source (web clients); the JSON body
      // is an explicit fallback for mobile / programmatic clients.
      const rawBody = await request.json().catch(() => null);
      const bodyToken = RefreshTokenSchema.safeParse(rawBody);
      const rawToken =
        request.cookies.get(REFRESH_COOKIE)?.value ??
        (bodyToken.success ? bodyToken.data.refreshToken : null);

      if (!rawToken) {
        throw new ValidationError('Missing refresh token');
      }

      const session = await authService.refreshToken(rawToken);

      logEvent({
        event: EventType.REFRESH_TOKEN,
        userId: session.user.id,
        method: 'POST',
        api: '/api/auth/refresh-token',
      });

      return this.sessionResponse(request, session);
    } catch (error) {
      return errorResponse(error);
    }
  }

  async signOut(request: NextRequest): Promise<NextResponse> {
    try {
      await authService.signOut(request.cookies.get(REFRESH_COOKIE)?.value ?? null);

      logEvent({ event: EventType.SIGNOUT, method: 'POST', api: '/api/auth/sign-out' });

      const response = NextResponse.json({ message: 'Signed out' });
      response.cookies.delete(REFRESH_COOKIE);
      return response;
    } catch (error) {
      return errorResponse(error);
    }
  }

  private async validate<S extends z.ZodType>(
    request: NextRequest,
    schema: S,
  ): Promise<z.output<S>> {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON body');
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.flatten());
    }
    return parsed.data;
  }

  /**
   * Issues the session response: access token + user in the body (consumed by
   * the Zustand auth store), refresh token as an httpOnly cookie. The refresh
   * token is additionally returned once for mobile clients.
   */
  private sessionResponse(request: NextRequest, session: AuthSessionResponse): NextResponse {
    const response = NextResponse.json({
      user: session.user,
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      refreshToken: session.refreshToken,
    });

    response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: env().NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: env().REFRESH_TOKEN_TTL,
    });

    return response;
  }
}

export const authController = new AuthController();
