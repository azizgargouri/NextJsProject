import { employeesController } from '@/server/modules/employees/employees.controller';
import type { NextRequest } from 'next/server';

/** GET /api/employees/me — employee profile linked to the signed-in account. */
export async function GET(request: NextRequest) {
  return employeesController.me(request);
}
