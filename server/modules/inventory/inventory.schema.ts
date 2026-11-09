import { z } from 'zod';

export const INVENTORY_MAX_PHOTOS = 3;
export const INVENTORY_PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const INVENTORY_DESCRIPTION_MAX = 2000;

export const InventoryRequestSchema = z
  .object({
    description: z.string().trim().max(INVENTORY_DESCRIPTION_MAX).default(''),
    locale: z.enum(['en', 'fr']).default('en'),
  })
  .strict();

export type InventoryRequest = z.infer<typeof InventoryRequestSchema>;

const ROOMS = ['living', 'bedroom', 'kitchen', 'office', 'other'] as const;

/** What the model must return. Validated again with zod after parsing. */
export const ModelInventorySchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(40),
        label: z.string().trim().min(1).max(60),
        room: z.enum(ROOMS).catch('other'),
        quantity: z.coerce.number().int().min(1).max(100),
        unitM3: z.coerce.number().optional(),
        assumed: z.boolean().catch(false),
      }),
    )
    .max(80),
  note: z.string().trim().max(240).nullish(),
});

export type ModelInventory = z.infer<typeof ModelInventorySchema>;

/** JSON schema handed to Ollama's `format` so decoding is constrained. */
export const MODEL_INVENTORY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          room: { type: 'string', enum: [...ROOMS] },
          quantity: { type: 'integer', minimum: 1 },
          unitM3: { type: 'number' },
          assumed: { type: 'boolean' },
        },
        required: ['key', 'label', 'room', 'quantity', 'assumed'],
      },
    },
    note: { type: ['string', 'null'] },
  },
  required: ['items', 'note'],
} as const;
