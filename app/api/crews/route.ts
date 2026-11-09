import { crewsController } from '@/server/modules/crews/crews.controller';
import type { NextRequest } from 'next/server';

/** GET /api/crews — HR crew list. POST /api/crews — create a crew. */
export async function GET(request: NextRequest) {
  return crewsController.list(request);
}

export async function POST(request: NextRequest) {
  return crewsController.create(request);
}
