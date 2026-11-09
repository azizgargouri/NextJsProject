import { z } from 'zod';
import { MOVE_STAGE_KEYS } from '../../shared/database/models/move.model';

export const MoveCreateSchema = z.object({
  pickupAddress: z.string().trim().min(3),
  destinationAddress: z.string().trim().min(3),
  distance: z.number().positive().max(500),
  items: z.array(z.object({
    id: z.string(), name: z.string(), volume: z.number().positive(), weight: z.number().positive(), quantity: z.number().int().positive(),
    category: z.string().trim().max(80).optional(), room: z.string().trim().max(80).optional(),
    isFragile: z.boolean().optional(), needsDisassembly: z.boolean().optional(),
  })).min(1),
  pickup: z.object({ city: z.string().trim().min(2).optional(), zone: z.string().trim().min(2).max(12).optional(), postalCode: z.string().trim().max(16).optional(), floor: z.number().int().min(-5).max(100).optional(), hasElevator: z.boolean().optional(), accessNotes: z.string().trim().max(500).optional() }).optional(),
  dropoff: z.object({ city: z.string().trim().min(2).optional(), zone: z.string().trim().min(2).max(12).optional(), postalCode: z.string().trim().max(16).optional(), floor: z.number().int().min(-5).max(100).optional(), hasElevator: z.boolean().optional(), accessNotes: z.string().trim().max(500).optional() }).optional(),
  housingType: z.string().trim().max(80).optional(),
  sizeRooms: z.number().int().min(0).max(50).optional(),
  extraServices: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  notes: z.string().trim().max(2000).optional(),
  vehicleName: z.string().trim().min(2).optional(),
  moveDate: z.iso.date().optional(),
  timeSlot: z.enum(['MORNING', 'AFTERNOON', 'FULL_DAY']).optional(),
});

export const MoveStageUpdateSchema = z.object({ stage: z.enum(MOVE_STAGE_KEYS) });
export type MoveCreateInput = z.infer<typeof MoveCreateSchema>;
