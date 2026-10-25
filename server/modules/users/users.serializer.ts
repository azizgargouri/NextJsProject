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
  createdAt: string;
  updatedAt: string;
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
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
