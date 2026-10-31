import { employeesController } from '@/server/modules/employees/employees.controller';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return employeesController.list(request);
}

export async function POST(request: NextRequest) {
  return employeesController.create(request);
}
