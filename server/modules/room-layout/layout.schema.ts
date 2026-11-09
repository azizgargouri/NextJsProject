import { z } from 'zod';
import { PLACEMENT_WALLS } from './ai/layout-prompt';

const unitId = z.string().trim().min(1).max(60);
const roomId = z.string().trim().min(1).max(40);
const cm = z.number().int().min(0).max(3000);

/** One manual change to a saved layout. `move` and `place` also place a left-out item. */
export const LayoutItemUpdateSchema = z.discriminatedUnion('action', [
  /** Menu: a room + wall, the server finds the spot. */
  z.object({ action: z.literal('move'), unitId, roomId, wall: z.enum(PLACEMENT_WALLS) }),
  /** Drag and drop: an exact rectangle (cm) the server re-checks. */
  z.object({
    action: z.literal('place'),
    unitId,
    roomId,
    x: cm,
    y: cm,
    w: cm.min(1),
    h: cm.min(1),
  }),
  z.object({ action: z.literal('rotate'), unitId }),
  z.object({ action: z.literal('remove'), unitId }),
]);

export type LayoutItemUpdateInput = z.infer<typeof LayoutItemUpdateSchema>;

/** Generate: optional room per piece, chosen by the client; the rest is up to the assistant. */
export const LayoutGenerateSchema = z.object({
  roomChoices: z
    .array(z.object({ unitId, roomId: z.string().trim().min(1).max(40) }))
    .max(500)
    .default([]),
});

export type LayoutGenerateInput = z.infer<typeof LayoutGenerateSchema>;
