import { leaveRequestsController } from '@/server/modules/leave-requests/leave-requests.controller';
import type { NextRequest } from 'next/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return leaveRequestsController.decide(request, (await params).id);
}
