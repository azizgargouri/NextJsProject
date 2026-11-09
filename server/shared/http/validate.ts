import type { z } from 'zod';
import { ValidationError } from '../database/errors';

/** Parses a JSON body against a Zod schema; throws a typed 422 on failure. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten());
  return parsed.data;
}

/** Parses URL search params against a Zod schema (list filters, pagination). */
export function parseQuery<S extends z.ZodType>(request: Request, schema: S): z.output<S> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw new ValidationError('Invalid query', parsed.error.flatten());
  return parsed.data;
}
