import type { Role, UserStatus } from '../../shared/database/enums';

/** Whitelisted user response (never exposes passwordHash). */
export interface UserResponse {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: Role;
  locale: string;
  status: UserStatus;
  /** Public address of the auto-created app wallet (never the private key). */
  walletAddress: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Maps a user row to the whitelisted response DTO. */
export function avatarUrlFor(user: { id: string; avatarKey?: string | null }): string | null {
  return user.avatarKey ? `/api/files/avatars/${user.id}?v=${user.avatarKey.split('/').pop()?.split('.')[0] ?? '0'}` : null;
}
export function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: Role;
  locale: string;
  status: UserStatus;
  walletAddress: string | null;
  avatarKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    locale: user.locale,
    status: user.status,
    walletAddress: user.walletAddress,
    avatarUrl: avatarUrlFor(user),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
