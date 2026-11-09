import type { NextRequest } from 'next/server';
import { movesController } from '@/server/modules/moves/moves.controller';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return movesController.findOne(request, (await params).id); }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return movesController.advance(request, (await params).id); }
