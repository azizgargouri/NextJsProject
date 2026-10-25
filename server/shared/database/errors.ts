/** Base class for every typed domain error. Maps to a stable HTTP status + error code. */
export class DomainError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

export class BadRequestError extends DomainError {
  constructor(message = 'Bad request') {
    super(message, 400, 'BAD_REQUEST');
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string) {
    super(`${entity} not found`, 404, `${entity.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`);
  }
}

export class AlreadyExistsError extends DomainError {
  constructor(entity: string, field?: string) {
    const base = `${entity} already exists`;
    super(
      field ? `${base} (${field})` : base,
      409,
      `${entity.toUpperCase().replace(/\s+/g, '_')}_ALREADY_EXISTS`,
    );
  }
}

export class ValidationError extends DomainError {
  readonly details: unknown;

  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR');
    this.details = details;
  }
}

/** Maps a domain error to a JSON response body. Unknown errors fall back to 500. */
export function toErrorBody(error: unknown): {
  status: number;
  body: { message: string; code: string; details?: unknown };
} {
  if (error instanceof DomainError) {
    return {
      status: error.status,
      body: {
        message: error.message,
        code: error.code,
        ...(error instanceof ValidationError && error.details ? { details: error.details } : {}),
      },
    };
  }

  return {
    status: 500,
    body: { message: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
  };
}
