import type { Role } from '../../shared/database/enums';
import type { UserResponse } from '../users/users.serializer';

/** Token pair issued by the auth service (jose HS256 access + opaque refresh). */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Internal auth result across the service layer boundary. */
export interface AuthenticatedUserResponse extends UserResponse {
  tokens: TokenPair;
}

/** Public auth response shape — the contract consumed by the frontend stores. */
export interface AuthSessionResponse {
  user: {
    id: string;
    email: string;
    name: string;
    phone: string;
    role: Role;
    locale: string;
    createdAt: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Maps the internal auth result to the whitelisted session DTO. */
export function serializeAuthSession(response: AuthenticatedUserResponse): AuthSessionResponse {
  return {
    user: {
      id: response.id,
      email: response.email,
      name: response.name,
      phone: response.phone,
      role: response.role,
      locale: response.locale,
      createdAt: response.createdAt,
    },
    accessToken: response.tokens.accessToken,
    refreshToken: response.tokens.refreshToken,
    expiresIn: response.tokens.expiresIn,
  };
}
