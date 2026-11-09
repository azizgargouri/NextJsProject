import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { errorResponse, requireRole } from '../../shared/auth/guards';
import { ValidationError } from '../../shared/database/errors';
import type { ClientRef } from '../room-layout/move-requests.service';
import {
  HomeCreateSchema,
  HomeUpdateSchema,
  RoomCreateSchema,
  RoomUpdateSchema,
} from './homes.schema';
import { homesService } from './homes.service';

/** Parses a JSON body against a schema or throws a 422 with field details. */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
  message: string,
): Promise<T> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ValidationError(message, parsed.error.flatten());
  return parsed.data;
}

/** Wraps a handler: CLIENT-only guard + central error mapping. */
export async function asClient(
  request: Request,
  handler: (client: ClientRef) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const client = await requireRole(request, ['CLIENT']);
    return await handler({ id: client.sub });
  } catch (error) {
    return errorResponse(error);
  }
}

/** HTTP adapter for the client's houses (thin: parse → service → respond). */
class HomesController {
  list(request: Request) {
    return asClient(request, async (client) =>
      NextResponse.json(await homesService.listMine(client, new URL(request.url).searchParams)),
    );
  }

  create(request: Request) {
    return asClient(request, async (client) => {
      const input = await parseBody(request, HomeCreateSchema, 'Please check the house details');
      return NextResponse.json(
        { home: await homesService.createMine(client, input) },
        { status: 201 },
      );
    });
  }

  findOne(request: Request, homeId: string) {
    return asClient(request, async (client) =>
      NextResponse.json({ home: await homesService.getMine(client, homeId) }),
    );
  }

  update(request: Request, homeId: string) {
    return asClient(request, async (client) => {
      const input = await parseBody(request, HomeUpdateSchema, 'Please check the house details');
      return NextResponse.json({ home: await homesService.updateMine(client, homeId, input) });
    });
  }

  remove(request: Request, homeId: string) {
    return asClient(request, async (client) =>
      NextResponse.json({ home: await homesService.deleteMine(client, homeId) }),
    );
  }

  addRoom(request: Request, homeId: string) {
    return asClient(request, async (client) => {
      const input = await parseBody(request, RoomCreateSchema, 'Please check the room details');
      return NextResponse.json(
        { home: await homesService.addRoom(client, homeId, input) },
        { status: 201 },
      );
    });
  }

  updateRoom(request: Request, homeId: string, roomId: string) {
    return asClient(request, async (client) => {
      const input = await parseBody(request, RoomUpdateSchema, 'Please check the room details');
      return NextResponse.json({
        home: await homesService.updateRoom(client, homeId, roomId, input),
      });
    });
  }

  listMoveRequests(request: Request) {
    return asClient(request, async (client) =>
      NextResponse.json({ moveRequests: await homesService.listMoveRequests(client) }),
    );
  }

  removeRoom(request: Request, homeId: string, roomId: string) {
    return asClient(request, async (client) =>
      NextResponse.json({ home: await homesService.removeRoom(client, homeId, roomId) }),
    );
  }
}

export const homesController = new HomesController();
