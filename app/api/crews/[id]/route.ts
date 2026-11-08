import { crewsController } from '@/server/modules/crews/crews.controller';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return crewsController.get(request, (await params).id);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return crewsController.update(request, (await params).id);
}

/** Archives the crew; historical tracking data remains intact. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return crewsController.archive(request, (await params).id);
}
