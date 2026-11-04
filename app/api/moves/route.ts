export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { movesController } from '@/server/modules/moves/moves.controller';

export async function GET(request: NextRequest) {
  return movesController.list(request);
}

export async function POST(request: NextRequest) {
  return movesController.create(request);
}
