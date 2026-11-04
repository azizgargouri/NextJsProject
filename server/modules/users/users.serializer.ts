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
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Same-origin avatar route; the version query busts caches after each change. */
export function avatarUrlFor(user: { id: string; avatarKey?: string | null }): string | null {
  if (!user.avatarKey) return null;
  const version = user.avatarKey.split('/').pop()?.split('.')[0] ?? '0';
  return `/api/files/avatars/${user.id}?v=${version}`;
}

/** Maps a user row to the whitelisted response DTO. */
export function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: Role;
  locale: string;
  status: UserStatus;
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
    avatarUrl: avatarUrlFor(user),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
