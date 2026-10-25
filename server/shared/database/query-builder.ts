import { z } from 'zod';
import { BadRequestError } from './errors';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().optional(),
  sort: z.string().optional(),
  filter: z.string().optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

/**
 * Parses standardized list params (page / limit / search / sort / filter)
 * replicating the instanct-api query DSL. Domain repositories consume this
 * to build their Mongoose `where` / `sort` queries.
 */
export function parseListQuery(searchParams: URLSearchParams): ListQuery {
  const raw = Object.fromEntries(
    Array.from(searchParams.keys())
      .map((key) => [
        key,
        searchParams.getAll(key).length > 1 ? searchParams.getAll(key) : searchParams.get(key),
      ])
      .filter(([, value]) => value !== null && value !== ''),
  );

  const parsed = listQuerySchema.safeParse(raw);
  if (!parsed.success) {
    throw new BadRequestError('Invalid query parameters');
  }
  return parsed.data;
}

/**
 * Compiles the `sort` DSL value ("field,ASC;field2,DESC") into a Mongoose sort
 * object, restricted to the caller-provided allowlist of sortable fields.
 */
export function compileSort(
  sort: string | undefined,
  allowedFields: readonly string[],
): Record<string, 'asc' | 'desc'> {
  const entries = (sort ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [field = '', direction = 'ASC'] = part.split(',');
      const order: 'asc' | 'desc' = direction.toUpperCase() === 'DESC' ? 'desc' : 'asc';
      return allowedFields.includes(field) ? [field, order] : null;
    })
    .filter((entry): entry is [string, 'asc' | 'desc'] => entry !== null);

  return Object.fromEntries(entries);
}
