import { crewsController } from '@/server/modules/crews/crews.controller';
import type { NextRequest } from 'next/server';

/** POST /api/crews/:id/members — add employees to a crew. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return crewsController.addMembers(request, (await params).id);
}
