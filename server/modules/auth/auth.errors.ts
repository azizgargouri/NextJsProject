import { DomainError } from '../../shared/database/errors';

/** Typed domain errors for the auth module (mirrors instanct-api per-domain errors). */
export class UserNotFoundError extends DomainError {
  constructor() {
    super('User not found', 404, 'USER_NOT_FOUND');
  }
}

export class UserAlreadyExistsError extends DomainError {
  constructor(field: string) {
    super(`User already exists (${field})`, 409, 'USER_ALREADY_EXISTS');
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
}

export class InvalidRefreshTokenError extends DomainError {
  constructor() {
    super('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }
}

export class UserBlockedError extends DomainError {
  constructor() {
    super('Account is blocked', 403, 'USER_BLOCKED');
  }
}
