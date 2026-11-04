import { z } from 'zod';
import { UserPasswordSchema } from '../users/users.schema';

/** Self-service profile fields. Email and role stay admin-managed. */
export const ProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{8,15}$/, 'Invalid phone number'),
    locale: z.enum(['en', 'fr', 'ar']),
  })
  .partial();

export const PasswordChangeBaseSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: UserPasswordSchema,
  confirmPassword: z.string().min(1, 'Confirm the new password'),
  signOutOtherSessions: z.boolean().default(true),
});

export const PasswordChangeSchema = PasswordChangeBaseSchema.refine(
  (value) => value.newPassword === value.confirmPassword,
  { message: 'Passwords do not match', path: ['confirmPassword'] },
).refine((value) => value.newPassword !== value.currentPassword, {
  message: 'Choose a password different from the current one',
  path: ['newPassword'],
});

export const NotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.iso.datetime().optional(),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
export type PasswordChangeInput = z.infer<typeof PasswordChangeSchema>;
export type NotificationsQuery = z.infer<typeof NotificationsQuerySchema>;
