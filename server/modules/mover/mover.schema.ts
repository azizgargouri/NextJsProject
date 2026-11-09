import { z } from 'zod';
import {
  DOCUMENT_TYPES,
  MESSAGE_THREADS,
  TIME_SLOTS,
  VEHICLE_TYPES,
} from '../../shared/database/enums';
import { ZONE_CODES } from './mover.constants';

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, 'This date does not exist');

export const OfferResponseSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ACCEPT') }),
  z.object({ action: z.literal('DECLINE'), reason: z.string().trim().max(300).optional() }),
  z.object({
    action: z.literal('QUOTE'),
    amount: z.coerce
      .number()
      .positive('Enter an amount above zero')
      .max(1_000_000, 'This amount is too high'),
    message: z.string().trim().max(500).optional(),
  }),
]);
export type OfferResponseInput = z.infer<typeof OfferResponseSchema>;

export const JobStatusSchema = z.object({
  action: z.enum(['EN_ROUTE', 'LOADING', 'IN_TRANSIT', 'DELIVERED']),
});

export const AvailabilitySetSchema = z.object({
  date: isoDay,
  /** Null clears the day. */
  slot: z.enum(TIME_SLOTS).nullable(),
});
export type AvailabilitySetInput = z.infer<typeof AvailabilitySetSchema>;

export const AvailabilityRangeSchema = z.object({ from: isoDay, to: isoDay });

export const MoverProfileUpdateSchema = z.object({
  companyName: z.string().trim().min(2, 'Enter your company name').max(120).optional(),
  taxId: z.string().trim().max(40).optional(),
  bio: z.string().trim().max(1000).optional(),
  zones: z.array(z.enum(ZONE_CODES)).max(ZONE_CODES.length).optional(),
});
export type MoverProfileUpdateInput = z.infer<typeof MoverProfileUpdateSchema>;

export const VehicleSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  capacityM3: z.coerce.number().positive('Enter a capacity above zero').max(200),
  plate: z.string().trim().min(2, 'Enter the plate number').max(20),
});
export type VehicleInput = z.infer<typeof VehicleSchema>;

export const TeamMemberSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(80),
  phone: z.string().trim().max(20).optional(),
  role: z.string().trim().max(60).optional(),
});
export type TeamMemberInput = z.infer<typeof TeamMemberSchema>;

export const DocumentMetaSchema = z
  .object({
    type: z.enum(DOCUMENT_TYPES),
    expiresAt: isoDay.optional(),
  })
  .refine((value) => value.type !== 'INSURANCE' || Boolean(value.expiresAt), {
    path: ['expiresAt'],
    message: 'Insurance needs an expiry date',
  });

export const MessageThreadSchema = z.enum(MESSAGE_THREADS);
export const MessageCreateSchema = z.object({
  thread: MessageThreadSchema,
  body: z.string().trim().min(1, 'Write a message first').max(2000),
});

export const PhotoStageSchema = z.enum(['PICKUP', 'LOAD', 'DELIVERY']);

const loadCount = z.coerce
  .number()
  .int('Enter a whole number')
  .min(0, 'Enter zero or more')
  .max(10_000, 'This number is too high');

export const LoadCheckSchema = z
  .object({
    boxes: loadCount,
    furniture: loadCount,
    note: z.string().trim().max(500).optional(),
    confirmed: z.literal(true, 'Confirm that you checked the photos and counts'),
  })
  .refine((value) => value.boxes + value.furniture > 0, {
    path: ['boxes'],
    message: 'Enter how many boxes or pieces of furniture you loaded',
  });
export type LoadCheckInput = z.infer<typeof LoadCheckSchema>;

export const NotificationsReadSchema = z.object({
  /** Omit to mark everything as read. */
  ids: z.array(z.string()).max(100).optional(),
});
