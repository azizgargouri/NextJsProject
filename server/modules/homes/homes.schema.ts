import { z } from 'zod';
import {
  HOME_TYPES,
  OPENING_KINDS,
  ROOM_TYPES,
  WALLS,
} from '../../shared/database/models/home.model';

export const HOME_LIMITS = { homesPerClient: 10, roomsPerHome: 20, openingsPerRoom: 8 } as const;

/** Room side between 50 cm and 30 m keeps drawings and AI prompts sane. */
const roomSide = z.coerce.number().int().min(50, 'At least 50 cm').max(3000, 'At most 30 m');

export const OpeningSchema = z.object({
  kind: z.enum(OPENING_KINDS),
  wall: z.enum(WALLS),
  offsetCm: z.coerce.number().int().min(0, 'Cannot be negative'),
  widthCm: z.coerce.number().int().min(30, 'At least 30 cm').max(600, 'At most 6 m'),
});

export const RoomCreateSchema = z
  .object({
    name: z.string().trim().min(2, 'At least 2 characters').max(40),
    type: z.enum(ROOM_TYPES),
    widthCm: roomSide,
    lengthCm: roomSide,
    notes: z.string().trim().max(300).default(''),
    openings: z.array(OpeningSchema).max(HOME_LIMITS.openingsPerRoom).default([]),
  })
  .superRefine((room, ctx) => {
    room.openings.forEach((opening, index) => {
      const wallLength =
        opening.wall === 'N' || opening.wall === 'S' ? room.widthCm : room.lengthCm;
      if (opening.offsetCm + opening.widthCm > wallLength) {
        ctx.addIssue({
          code: 'custom',
          path: ['openings', index, 'offsetCm'],
          message: `Does not fit: the ${opening.wall} wall is ${wallLength} cm long`,
        });
      }
    });
  });

/** Room PATCH sends the full room: openings are validated against the room's own sides. */
export const RoomUpdateSchema = RoomCreateSchema;

const homeFields = {
  label: z.string().trim().min(2, 'At least 2 characters').max(60),
  city: z.string().trim().min(2, 'At least 2 characters').max(60),
  type: z.enum(HOME_TYPES),
  floor: z.coerce.number().int().min(0).max(60),
  hasElevator: z.boolean(),
  notes: z.string().trim().max(500),
};

export const HomeCreateSchema = z.object({
  ...homeFields,
  floor: homeFields.floor.default(0),
  hasElevator: homeFields.hasElevator.default(false),
  notes: homeFields.notes.default(''),
});

/**
 * Built from the fields WITHOUT defaults: in Zod 4, `.partial()` keeps inner
 * `.default()`s, so a PATCH that omits `floor` would silently reset it to 0.
 */
export const HomeUpdateSchema = z
  .object(homeFields)
  .partial()
  .extend({
    /** Link (reference) or unlink (null) the client's move request. */
    moveReference: z.string().trim().toUpperCase().min(3).max(40).nullable().optional(),
  });

export type OpeningInput = z.infer<typeof OpeningSchema>;
export type RoomCreateInput = z.infer<typeof RoomCreateSchema>;
export type RoomUpdateInput = z.infer<typeof RoomUpdateSchema>;
export type HomeCreateInput = z.infer<typeof HomeCreateSchema>;
export type HomeUpdateInput = z.infer<typeof HomeUpdateSchema>;
