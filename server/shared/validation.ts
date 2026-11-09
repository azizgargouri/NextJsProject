import type { z } from 'zod';
import { ValidationError } from './database/errors';

/**
 * Reads and validates a JSON request body against a Zod schema.
 * Shared by the RH controllers (parse → service → serialize convention).
 */
export async function parseJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }
  return parsed.data;
}
