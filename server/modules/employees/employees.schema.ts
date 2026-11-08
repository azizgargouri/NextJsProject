import { z } from 'zod';
import { EMPLOYEE_ROLES, EMPLOYEE_STATUSES } from '../../shared/database/enums';

/**
 * Optional wallet address. Empty strings (from forms) become null so the
 * directory can be cleared without breaking Mongoose validation.
 */
export const WalletAddressSchema = z
  .union([
    z
      .string()
      .trim()
      .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address (expected 0x + 40 hex chars)'),
    z.literal(''),
    z.null(),
  ])
  .optional()
  .transform((value) => (value ? value.toLowerCase() : null));

/** Create payload — mirrors the local module's POST /api/employees contract. */
export const EmployeeCreateSchema = z.object({
  employeeRef: z.string().trim().min(1, 'Employee ref is required'),
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(EMPLOYEE_ROLES).default('employee'),
  status: z.enum(EMPLOYEE_STATUSES).default('active'),
  walletAddress: WalletAddressSchema,
});

/** Update payload — only the editable fields of the local PATCH handler. */
export const EmployeeUpdateSchema = EmployeeCreateSchema.partial().omit({
  employeeRef: true,
});

/** List query — optional free-text search over ref / name / email. */
export const EmployeeQuerySchema = z.object({
  search: z.string().trim().optional(),
});

export type EmployeeCreateInput = z.infer<typeof EmployeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof EmployeeUpdateSchema>;
export type EmployeeQuery = z.infer<typeof EmployeeQuerySchema>;
