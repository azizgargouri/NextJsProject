import { z } from 'zod';

const money = z.coerce.number().min(0, 'Must be zero or positive');

const isoDate = z.coerce.date();

/** Plain object variant — reusable for create (refined) and update (partial). */
const PricingRuleBaseSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(64),
  status: z.enum(['ACTIVE', 'RETIRED']).default('ACTIVE'),
  baseFare: money,
  perKm: money,
  perM3: money,
  expressSurcharge: z.coerce.number().min(0).max(100, 'Express surcharge is a percentage'),
  minQuote: money,
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullish(),
});

export const PricingRuleCreateSchema = PricingRuleBaseSchema.refine(
  (rule) => !rule.effectiveTo || rule.effectiveTo > rule.effectiveFrom,
  { message: 'The effective window must end after it starts', path: ['effectiveTo'] },
);

export const PricingRuleUpdateSchema = PricingRuleBaseSchema.partial();

export type PricingRuleCreateInput = z.infer<typeof PricingRuleCreateSchema>;
export type PricingRuleUpdateInput = z.infer<typeof PricingRuleUpdateSchema>;
