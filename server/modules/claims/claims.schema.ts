import { z } from 'zod';
import {
  CLAIM_CATEGORIES,
  CLAIM_OUTCOMES,
  CLAIM_PRIORITIES,
  CLAIM_STATUSES,
  DAMAGE_SEVERITIES,
} from '../../shared/database/enums';
import { DamageVisionSchema } from '../../../lib/quality/ai-schemas';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const dataUrlOrHttpImage = z
  .string()
  .trim()
  .max(12_000_000, 'Image payload too large')
  .refine(
    (val) =>
      val.startsWith('data:image/') ||
      val.startsWith('http://') ||
      val.startsWith('https://') ||
      val.startsWith('/'),
    'Invalid image format',
  );

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
  /** Optional array of base64/URL evidence photos or JSON-encoded string from FormData. */
  evidencePhotos: z
    .union([
      z.array(dataUrlOrHttpImage).max(8),
      z
        .string()
        .optional()
        .transform((raw) => {
          if (!raw?.trim()) return [];
          try {
            const parsed = JSON.parse(raw) as unknown;
            return Array.isArray(parsed)
              ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 8)
              : [];
          } catch {
            return [];
          }
        }),
    ])
    .optional(),
  /** Optional pre-computed vision analysis JSON from the client scanner. */
  visionAnalysisJson: z
    .string()
    .optional()
    .transform((raw) => {
      if (!raw?.trim()) return undefined;
      try {
        const parsed = JSON.parse(raw) as unknown;
        const checked = DamageVisionSchema.safeParse(parsed);
        return checked.success ? checked.data : undefined;
      } catch {
        return undefined;
      }
    }),
});
export type ClaimCreateInput = z.infer<typeof ClaimCreateSchema>;

export const PhotoAnnotationInputSchema = z.object({
  label: z.string().trim().max(160).optional(),
  roiCoveragePct: z.number().min(0).max(100).optional(),
  boxCount: z.number().int().min(0).max(20).optional(),
});
export type PhotoAnnotationInput = z.infer<typeof PhotoAnnotationInputSchema>;

/** Request payload for POST /api/ai/claims/vision */
export const ClaimVisionRequestSchema = z.object({
  images: z.array(dataUrlOrHttpImage).min(1, 'Attach at least one photo').max(8),
  hint: z.string().trim().max(600).optional(),
  presetId: z.string().trim().max(60).optional(),
  photoAnnotations: z.array(PhotoAnnotationInputSchema).max(8).optional(),
});
export type ClaimVisionRequestInput = z.infer<typeof ClaimVisionRequestSchema>;

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
  severity: z.enum([...DAMAGE_SEVERITIES, 'ALL']).optional(),
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
