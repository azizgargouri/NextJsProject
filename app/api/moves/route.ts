import type { NextRequest } from 'next/server';
import { movesController } from '@/server/modules/moves/moves.controller';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) { return movesController.create(request); }
