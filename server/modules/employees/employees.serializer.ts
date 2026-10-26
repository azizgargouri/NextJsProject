import type { EmployeeRole, EmployeeStatus } from '../../shared/database/enums';

/** Whitelisted employee response. */
export interface EmployeeResponse {
  id: string;
  employeeRef: string;
  fullName: string;
  email: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  hireDate: string | null;
  organization: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Maps an employee row to the whitelisted response DTO. */
export function serializeEmployee(row: {
  id: string;
  employeeRef: string;
  fullName: string;
  email: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  hireDate: Date | null;
  organization: string | null;
  createdAt: Date;
  updatedAt: Date;
}): EmployeeResponse {
  return {
    id: row.id,
    employeeRef: row.employeeRef,
    fullName: row.fullName,
    email: row.email,
    role: row.role,
    status: row.status,
    hireDate: row.hireDate ? row.hireDate.toISOString() : null,
    organization: row.organization,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Compact employee reference embedded in attendance / leave responses. */
export interface EmployeeRefResponse {
  id: string;
  employeeRef: string;
  fullName: string;
}

export function serializeEmployeeRef(row: {
  id: string;
  employeeRef: string;
  fullName: string;
}): EmployeeRefResponse {
  return { id: row.id, employeeRef: row.employeeRef, fullName: row.fullName };
}
