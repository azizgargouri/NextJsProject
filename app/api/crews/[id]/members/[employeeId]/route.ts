import { crewsController } from '@/server/modules/crews/crews.controller';
import type { NextRequest } from 'next/server';

/** DELETE /api/crews/:id/members/:employeeId — remove an employee from a crew. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; employeeId: string }> },
) {
  const resolved = await params;
  return crewsController.removeMember(request, resolved.id, resolved.employeeId);
}
