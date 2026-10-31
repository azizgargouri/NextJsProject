import { z } from 'zod';
import { MOVE_STAGE_KEYS } from '../../shared/database/models/move.model';

export const MoveCreateSchema = z.object({
  pickupAddress: z.string().trim().min(3),
  destinationAddress: z.string().trim().min(3),
  distance: z.number().positive().max(500),
  items: z.array(z.object({ id: z.string(), name: z.string(), volume: z.number().positive(), weight: z.number().positive(), quantity: z.number().int().positive() })).min(1),
  vehicleName: z.string().trim().min(2).optional(),
});

export const MoveStageUpdateSchema = z.object({ stage: z.enum(MOVE_STAGE_KEYS) });
export type MoveCreateInput = z.infer<typeof MoveCreateSchema>;
