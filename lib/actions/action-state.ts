/**
 * Serializable result returned by every Server Action and consumed by `useActionState`.
 * Lives outside the "use server" module because such modules may only export async functions.
 */
export interface ActionState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Echoed values so the form keeps what the user typed after a validation error. */
  values?: Record<string, string>;
  redirectTo?: string;
  suggestion?: string;
}

export const initialActionState: ActionState = { ok: false, message: '' };
