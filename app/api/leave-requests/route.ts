import { leaveRequestsController } from '@/server/modules/leave-requests/leave-requests.controller';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return leaveRequestsController.list(request);
}

export async function POST(request: NextRequest) {
  return leaveRequestsController.create(request);
}
