import { z } from 'zod';

export const UserPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[0-9]/, 'Must contain a digit');

export const UserCreateSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: UserPasswordSchema,
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, 'Invalid phone number'),
  role: z.enum(['CLIENT', 'MOVER']).default('CLIENT'),
  locale: z.enum(['en', 'fr', 'ar']).default('en'),
});

export const UserUpdateSchema = UserCreateSchema.partial().omit({ password: true }).extend({
  password: UserPasswordSchema.optional(),
});

/** Admin-managed account input; public sign-up still cannot create ADMIN users. */
export const ManagedUserCreateSchema = UserCreateSchema.omit({ role: true }).extend({
  role: z.enum(['CLIENT', 'MOVER', 'ADMIN']),
  status: z.enum(['ACTIVE', 'BLOCKED']).default('ACTIVE'),
});

export const ManagedUserUpdateSchema = ManagedUserCreateSchema.partial();

export const UserQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().optional(),
  role: z.enum(['CLIENT', 'MOVER', 'ADMIN']).optional(),
});

export type UserCreateInput = z.infer<typeof UserCreateSchema>;
export type UserUpdateInput = z.infer<typeof UserUpdateSchema>;
export type UserQuery = z.infer<typeof UserQuerySchema>;
export type ManagedUserCreateInput = z.infer<typeof ManagedUserCreateSchema>;
export type ManagedUserUpdateInput = z.infer<typeof ManagedUserUpdateSchema>;
