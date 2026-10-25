import { jwtVerify, SignJWT } from 'jose';
import { createHash } from 'node:crypto';
import { env } from '../../config/env';

/** Token payload replicating instanct-api's AccessTokenPayload. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: 'CLIENT' | 'MOVER' | 'ADMIN';
  iat: number;
  exp: number;
}

const secret = () => {
  const raw = new TextEncoder().encode(env().JWT_SECRET);
  return raw;
};

export async function generateAccessToken(
  payload: Omit<AccessTokenPayload, 'iat' | 'exp'>,
): Promise<string> {
  const ttl = env().ACCESS_TOKEN_TTL;
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secret());
}

export async function generateRefreshToken(): Promise<string> {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secret());
  if (!payload.sub || typeof payload.email !== 'string') {
    throw new Error('Invalid token payload');
  }
  return {
    sub: payload.sub,
    email: payload.email,
    role: (payload.role as AccessTokenPayload['role']) ?? 'CLIENT',
    iat: payload.iat ?? 0,
    exp: payload.exp ?? 0,
  };
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
