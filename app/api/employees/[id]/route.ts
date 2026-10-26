import { employeesController } from '@/server/modules/employees/employees.controller';
import type { NextRequest } from 'next/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return employeesController.update(request, (await params).id);
}
