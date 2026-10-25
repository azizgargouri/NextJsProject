import { env } from '../../config/env';
import {
  generateAccessToken,
  generateRefreshToken,
  sha256Hex,
  type AccessTokenPayload,
} from '../../shared/auth/jwt';
import { comparePasswords } from '../../shared/auth/password';
import { UserService } from '../users/users.service';
import { serializeUser, type UserResponse } from '../users/users.serializer';
import { AuthRepository } from './auth.repository';
import { serializeAuthSession, type AuthSessionResponse, type TokenPair } from './auth.serializer';
import {
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  UserBlockedError,
  UserNotFoundError,
} from './auth.errors';
import type { SignInInput, SignUpInput } from './auth.schema'; /**
 * Auth business logic: sign-in / sign-up / token refresh / sign-out.
 * Owns password checks, JWT issuance and refresh-token rotation.
 * Returns the serialized session DTO consumed by both controller and client store.
 */
export class AuthService {
  private readonly tokens = new AuthRepository();
  private readonly users = new UserService();

  async signUp(input: SignUpInput): Promise<AuthSessionResponse> {
    const user = await this.users.createUser(input);
    return serializeAuthSession({
      ...user,
      tokens: await this.issueTokens(user.id, user.email, user.role),
    });
  }

  async signIn(input: SignInInput): Promise<AuthSessionResponse> {
    const user = await this.users.findByEmail(input.email);
    if (!user) throw new InvalidCredentialsError();

    const passwordOk = await comparePasswords(input.password, user.passwordHash);
    if (!passwordOk) throw new InvalidCredentialsError();
    if (user.status === 'BLOCKED') throw new UserBlockedError();

    return serializeAuthSession({
      ...serializeUser(user),
      tokens: await this.issueTokens(user.id, user.email, user.role),
    });
  }

  /** Refresh-token rotation: verify → revoke old → issue new pair. */
  async refreshToken(rawToken: string): Promise<AuthSessionResponse> {
    const tokenHash = sha256Hex(rawToken);
    const stored = await this.tokens.findValidByTokenHash(tokenHash);
    if (!stored) throw new InvalidRefreshTokenError();

    let user: UserResponse;
    try {
      user = await this.users.findOneByIdSerialized(stored.userId);
    } catch {
      throw new UserNotFoundError();
    }

    await this.tokens.revoke(stored.id);
    return serializeAuthSession({
      ...user,
      tokens: await this.issueTokens(user.id, user.email, user.role),
    });
  }

  async signOut(rawToken: string | null): Promise<void> {
    if (!rawToken) return;
    const tokenHash = sha256Hex(rawToken);
    const stored = await this.tokens.findValidByTokenHash(tokenHash);
    if (stored) {
      await this.tokens.revoke(stored.id);
    }
  }

  async validateAccessToken(token: string): Promise<AccessTokenPayload> {
    const { verifyAccessToken } = await import('../../shared/auth/jwt');
    return verifyAccessToken(token);
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: UserResponse['role'],
  ): Promise<TokenPair> {
    void email;
    const accessToken = await generateAccessToken({ sub: userId, email, role });
    const refreshToken = await generateRefreshToken();

    await this.tokens.saveToken({
      userId,
      tokenHash: sha256Hex(refreshToken),
      ttlSeconds: env().REFRESH_TOKEN_TTL,
    });

    void accessToken;
    return { accessToken, refreshToken, expiresIn: env().ACCESS_TOKEN_TTL };
  }
}

export const authService = new AuthService();
