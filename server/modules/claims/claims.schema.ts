import { z } from 'zod';
import {
  CLAIM_CATEGORIES,
  CLAIM_OUTCOMES,
  CLAIM_PRIORITIES,
  CLAIM_STATUSES,
} from '../../shared/database/enums';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

/** Client → new claim (validated identically by the Server Action and the REST route). */
export const ClaimCreateSchema = z.object({
  subject: z.string().trim().min(5, 'At least 5 characters').max(120),
  description: z
    .string()
    .trim()
    .min(20, 'Describe what happened (20 characters minimum)')
    .max(2000),
  category: z.enum(CLAIM_CATEGORIES),
  moverId: objectId.optional().or(z.literal('').transform(() => undefined)),
  moveReference: optionalText(40),
  amountClaimed: z.coerce
    .number()
    .min(0)
    .max(100_000)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});
export type ClaimCreateInput = z.infer<typeof ClaimCreateSchema>;

export const ClaimMessageSchema = z.object({
  text: z.string().trim().min(2).max(1000),
});
export type ClaimMessageInput = z.infer<typeof ClaimMessageSchema>;

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
};

export const ClaimPartyQuerySchema = z.object({
  ...pagination,
  status: z.enum([...CLAIM_STATUSES, 'ALL']).default('ALL'),
});
export type ClaimPartyQuery = z.infer<typeof ClaimPartyQuerySchema>;

export const ClaimAdminQuerySchema = z.object({
  ...pagination,
  status: z.enum([...CLAIM_STATUSES, 'ALL']).default('ALL'),
  priority: z.enum([...CLAIM_PRIORITIES, 'ALL']).default('ALL'),
  category: z.enum([...CLAIM_CATEGORIES, 'ALL']).default('ALL'),
  search: z.string().trim().max(80).optional(),
});
export type ClaimAdminQuery = z.infer<typeof ClaimAdminQuerySchema>;

/** Staff update: any subset, but RESOLVED requires a resolution (checked in the service). */
export const ClaimAdminUpdateSchema = z
  .object({
    status: z.enum(CLAIM_STATUSES).optional(),
    priority: z.enum(CLAIM_PRIORITIES).optional(),
    note: z.string().trim().max(1000).optional(),
    resolution: z
      .object({
        outcome: z.enum(CLAIM_OUTCOMES),
        amount: z.coerce.number().min(0).max(100_000).nullable().optional(),
        note: z.string().trim().min(10, 'Explain the decision (10 characters minimum)').max(1500),
      })
      .optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nothing to update',
  });
export type ClaimAdminUpdateInput = z.infer<typeof ClaimAdminUpdateSchema>;
