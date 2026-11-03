import { z } from 'zod';
import { REVIEW_STATUSES, SENTIMENTS } from '../../shared/database/enums';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Choose a mover');
const score = z.coerce.number().int().min(1).max(5);
const optionalScore = score.optional().or(z.literal('').transform(() => undefined));

export const ReviewCreateSchema = z.object({
  moverId: objectId,
  moveReference: z.string().trim().min(3, 'Enter the move reference').max(40),
  rating: score,
  punctuality: optionalScore,
  care: optionalScore,
  communication: optionalScore,
  comment: z
    .string()
    .trim()
    .min(10, 'Tell other clients a bit more (10 characters minimum)')
    .max(1000),
});
export type ReviewCreateInput = z.infer<typeof ReviewCreateSchema>;

export const ReviewReplySchema = z.object({
  text: z.string().trim().min(5).max(600),
});
export type ReviewReplyInput = z.infer<typeof ReviewReplySchema>;

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
};

export const ReviewPartyQuerySchema = z.object({ ...pagination });
export type ReviewPartyQuery = z.infer<typeof ReviewPartyQuerySchema>;

export const ReviewAdminQuerySchema = z.object({
  ...pagination,
  status: z.enum([...REVIEW_STATUSES, 'ALL']).default('ALL'),
  sentiment: z.enum([...SENTIMENTS, 'ALL']).default('ALL'),
  maxRating: z.coerce.number().int().min(1).max(5).optional(),
  moverId: objectId.optional(),
});
export type ReviewAdminQuery = z.infer<typeof ReviewAdminQuerySchema>;

export const ReviewModerateSchema = z.object({
  status: z.enum(REVIEW_STATUSES),
  note: z.string().trim().max(500).optional(),
});
export type ReviewModerateInput = z.infer<typeof ReviewModerateSchema>;

export const ReviewInsightsRequestSchema = z.object({
  moverId: objectId.optional(),
});
