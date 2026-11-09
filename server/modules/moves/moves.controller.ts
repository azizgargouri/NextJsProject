import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAuth, getCurrentUser } from '../../shared/auth/guards';
import { ValidationError } from '../../shared/database/errors';
import { MoveCreateSchema, MoveStageUpdateSchema } from './moves.schema';
import { movesService } from './moves.service';

class MovesController {
  async list(request: NextRequest) {
    try {
      const actor = await requireAuth(request);
      const moves = await movesService.list(actor);
      return NextResponse.json({ moves });
    } catch (error) {
      return errorResponse(error);
    }
  }

  async create(request: NextRequest) {
    try {
      const client = await requireAuth(request);
      if (client.role !== 'CLIENT') throw new ValidationError('Only a client account can request a move');
      const parsed = MoveCreateSchema.safeParse(await request.json());
      if (!parsed.success) throw new ValidationError('Please complete the move request', parsed.error.flatten());
      return NextResponse.json({ move: await movesService.create(parsed.data, client.sub) }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }

  async findOne(request: NextRequest, identifier: string) {
    try {
      const token = request.nextUrl.searchParams.get('token');
      const actor = await getCurrentUser(request);
      const move = await movesService.findOne(identifier, token, actor);
      return NextResponse.json({ move });
    } catch (error) {
      return errorResponse(error);
    }
  }

  async advance(request: NextRequest, identifier: string) {
    try {
      const actor = await requireAuth(request);
      const parsed = MoveStageUpdateSchema.safeParse(await request.json());
      if (!parsed.success) throw new ValidationError('Invalid move stage');
      return NextResponse.json({ move: await movesService.advance(identifier, parsed.data.stage, actor) });
    } catch (error) {
      return errorResponse(error);
    }
  }
}

export const movesController = new MovesController();
