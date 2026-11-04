import { isAxiosError } from 'axios';
import { z } from 'zod';
import type { ServerErrorResponse } from '@/types';
import {
  HOME_LIMITS,
  HOME_TYPES,
  OPENING_KINDS,
  ROOM_TYPES,
  WALLS,
  type HomeType,
  type RoomType,
  type Wall,
} from '@/types/homes';

/** Client-side mirrors of server/modules/homes/homes.schema.ts (same rules, same messages). */
const whole = (min: number, max: number, minMessage: string, maxMessage: string) =>
  z
    .number({ error: 'Enter a number' })
    .int('Whole number only')
    .min(min, minMessage)
    .max(max, maxMessage);

export const HomeFormSchema = z.object({
  label: z.string().trim().min(2, 'At least 2 characters').max(60, 'At most 60 characters'),
  city: z.string().trim().min(2, 'At least 2 characters').max(60, 'At most 60 characters'),
  type: z.enum(HOME_TYPES),
  floor: whole(0, 60, 'Cannot be negative', 'At most floor 60'),
  hasElevator: z.boolean(),
  notes: z.string().trim().max(500, 'At most 500 characters'),
});

export type HomeFormValues = z.infer<typeof HomeFormSchema>;

const roomSide = whole(50, 3000, 'At least 50 cm', 'At most 30 m (3000 cm)');

export const RoomFormSchema = z
  .object({
    name: z.string().trim().min(2, 'At least 2 characters').max(40, 'At most 40 characters'),
    type: z.enum(ROOM_TYPES),
    widthCm: roomSide,
    lengthCm: roomSide,
    notes: z.string().trim().max(300, 'At most 300 characters'),
    openings: z
      .array(
        z.object({
          kind: z.enum(OPENING_KINDS),
          wall: z.enum(WALLS),
          offsetCm: whole(0, 3000, 'Cannot be negative', 'Too far'),
          widthCm: whole(30, 600, 'At least 30 cm', 'At most 6 m'),
        }),
      )
      .max(HOME_LIMITS.openingsPerRoom),
  })
  .superRefine((room, ctx) => {
    room.openings.forEach((opening, index) => {
      const wallLength =
        opening.wall === 'N' || opening.wall === 'S' ? room.widthCm : room.lengthCm;
      if (opening.offsetCm + opening.widthCm > wallLength) {
        ctx.addIssue({
          code: 'custom',
          path: ['openings', index, 'offsetCm'],
          message: `Does not fit: the ${WALL_LABELS[opening.wall].toLowerCase()} wall is ${wallLength} cm`,
        });
      }
    });
  });

export type RoomFormValues = z.infer<typeof RoomFormSchema>;

export const HOME_TYPE_LABELS: Record<HomeType, string> = {
  APARTMENT: 'Apartment',
  VILLA: 'Villa',
  STUDIO: 'Studio',
  DUPLEX: 'Duplex',
};

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  LIVING: 'Living room',
  BEDROOM: 'Bedroom',
  KITCHEN: 'Kitchen',
  BATHROOM: 'Bathroom',
  DINING: 'Dining room',
  OFFICE: 'Office',
  KIDS: 'Kids room',
  STORAGE: 'Storage',
  BALCONY: 'Balcony',
  OTHER: 'Other',
};

export const WALL_LABELS: Record<Wall, string> = {
  N: 'North',
  E: 'East',
  S: 'South',
  W: 'West',
};

/** Human message from an Axios/API error (falls back when the server sent none). */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Try again.') {
  if (isAxiosError<ServerErrorResponse>(error)) return error.response?.data?.message ?? fallback;
  return fallback;
}
