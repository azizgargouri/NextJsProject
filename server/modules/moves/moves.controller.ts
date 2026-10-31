import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAuth } from '../../shared/auth/guards';
import { ValidationError } from '../../shared/database/errors';
import { MoveCreateSchema, MoveStageUpdateSchema } from './moves.schema';
import { movesService } from './moves.service';

class MovesController {
  async create(request: NextRequest) {
    try { const client = await requireAuth(request); if (client.role !== 'CLIENT') throw new ValidationError('Only a client account can request a move'); const parsed = MoveCreateSchema.safeParse(await request.json()); if (!parsed.success) throw new ValidationError('Please complete the move request', parsed.error.flatten()); return NextResponse.json({ move: await movesService.create(parsed.data, client.sub) }, { status: 201 }); } catch (error) { return errorResponse(error); }
  }
  async findOne(request: NextRequest, id: string) {
    try { const token = request.nextUrl.searchParams.get('token'); if (!token) throw new ValidationError('Missing tracking link'); return NextResponse.json({ move: await movesService.findOne(id, token) }); } catch (error) { return errorResponse(error); }
  }
  async advance(request: NextRequest, id: string) {
    try { const actor = await requireAuth(request); const parsed = MoveStageUpdateSchema.safeParse(await request.json()); if (!parsed.success) throw new ValidationError('Invalid move stage'); return NextResponse.json({ move: await movesService.advance(id, parsed.data.stage, actor) }); } catch (error) { return errorResponse(error); }
  }
}
export const movesController = new MovesController();
