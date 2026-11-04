import { z } from 'zod';

export const StorageListQuerySchema = z.object({
  prefix: z.string().trim().max(256).optional(),
  cursor: z.string().max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const StorageObjectKeySchema = z.object({
  key: z
    .string()
    .min(1, 'Object key is required')
    .max(1024)
    .refine((key) => !key.includes('..'), 'Invalid object key'),
});

export type StorageListQuery = z.infer<typeof StorageListQuerySchema>;
