import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { errorResponse, requireRole } from '../../shared/auth/guards';
import { ValidationError } from '../../shared/database/errors';
import {
  HomeCreateSchema,
  HomeUpdateSchema,
  RoomCreateSchema,
  RoomUpdateSchema,
} from './homes.schema';
import { homesService } from './homes.service';

/** Parses a JSON body against a schema or throws a 422 with field details. */
async function parseBody<T>(request: Request, schema: ZodType<T>, message: string): Promise<T> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ValidationError(message, parsed.error.flatten());
  return parsed.data;
}

/** Wraps a handler: CLIENT-only guard + central error mapping. */
async function asClient(
  request: Request,
  handler: (clientId: string) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const client = await requireRole(request, ['CLIENT']);
    return await handler(client.sub);
  } catch (error) {
    return errorResponse(error);
  }
}

/** HTTP adapter for the client's houses (thin: parse → service → respond). */
class HomesController {
  list(request: Request) {
    return asClient(request, async (clientId) =>
      NextResponse.json(await homesService.listMine(clientId, new URL(request.url).searchParams)),
    );
  }

  create(request: Request) {
    return asClient(request, async (clientId) => {
      const input = await parseBody(request, HomeCreateSchema, 'Please check the house details');
      return NextResponse.json(
        { home: await homesService.createMine(clientId, input) },
        { status: 201 },
      );
    });
  }

  findOne(request: Request, homeId: string) {
    return asClient(request, async (clientId) =>
      NextResponse.json({ home: await homesService.getMine(clientId, homeId) }),
    );
  }

  update(request: Request, homeId: string) {
    return asClient(request, async (clientId) => {
      const input = await parseBody(request, HomeUpdateSchema, 'Please check the house details');
      return NextResponse.json({ home: await homesService.updateMine(clientId, homeId, input) });
    });
  }

  remove(request: Request, homeId: string) {
    return asClient(request, async (clientId) =>
      NextResponse.json({ home: await homesService.deleteMine(clientId, homeId) }),
    );
  }

  addRoom(request: Request, homeId: string) {
    return asClient(request, async (clientId) => {
      const input = await parseBody(request, RoomCreateSchema, 'Please check the room details');
      return NextResponse.json(
        { home: await homesService.addRoom(clientId, homeId, input) },
        { status: 201 },
      );
    });
  }

  updateRoom(request: Request, homeId: string, roomId: string) {
    return asClient(request, async (clientId) => {
      const input = await parseBody(request, RoomUpdateSchema, 'Please check the room details');
      return NextResponse.json({
        home: await homesService.updateRoom(clientId, homeId, roomId, input),
      });
    });
  }

  removeRoom(request: Request, homeId: string, roomId: string) {
    return asClient(request, async (clientId) =>
      NextResponse.json({ home: await homesService.removeRoom(clientId, homeId, roomId) }),
    );
  }
}

export const homesController = new HomesController();
