/**
 * Serializable result envelope shared by server actions and the client
 * adapters that unwrap them. Server actions never throw domain errors across
 * the network boundary (Next redacts those in production), so every action
 * returns this discriminated union instead.
 */
export interface ActionFailure {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionFailure };

/** Error thrown on the client when a server action returns a failure envelope. */
export class ActionError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(failure: ActionFailure) {
    super(failure.message);
    this.name = 'ActionError';
    this.status = failure.status;
    this.code = failure.code;
    this.details = failure.details;
  }
}
