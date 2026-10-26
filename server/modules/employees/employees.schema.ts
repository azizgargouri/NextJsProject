import { z } from 'zod';
import { EMPLOYEE_ROLES, EMPLOYEE_STATUSES } from '../../shared/database/enums';

/** Create payload — mirrors the local module's POST /api/employees contract. */
export const EmployeeCreateSchema = z.object({
  employeeRef: z.string().trim().min(1, 'Employee ref is required'),
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(EMPLOYEE_ROLES).default('employee'),
  status: z.enum(EMPLOYEE_STATUSES).default('active'),
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
