import { DomainError } from '../database/errors';

export class TooManyRequestsError extends DomainError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('Too many requests, try again shortly', 429, 'TOO_MANY_REQUESTS');
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Fixed-window in-memory limiter, per key (usually client IP). Enough for a
 * single-process dev/demo server; swap for Redis when running several instances.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  return function check(key: string): void {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
    if (recent.length >= limit) {
      const oldest = recent[0] ?? now;
      throw new TooManyRequestsError(Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)));
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5_000) {
      for (const [k, times] of hits) {
        if (times.every((at) => now - at >= windowMs)) hits.delete(k);
      }
    }
  };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'local';
}
