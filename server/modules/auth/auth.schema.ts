import { z } from 'zod';

export const SignInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const SignUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a digit'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, 'Invalid phone number'),
  role: z.enum(['CLIENT', 'MOVER']).default('CLIENT'),
  locale: z.enum(['en', 'fr', 'ar']).default('en'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(16, 'Invalid refresh token'),
});

export type SignInInput = z.infer<typeof SignInSchema>;
export type SignUpInput = z.infer<typeof SignUpSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
