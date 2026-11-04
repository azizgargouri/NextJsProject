import { createHash } from 'node:crypto';
import { connectMongo } from '../../shared/database/mongoose';
import { BadRequestError, NotFoundError } from '../../shared/database/errors';
import {
  LayoutPlanModel,
  type LayoutPlanDoc,
} from '../../shared/database/models/layout-plan.model';
import type { HomeDetailResponse } from '../homes/homes.serializer';
import { homesService } from '../homes/homes.service';
import { planWithAi } from './ai/layout-ai';
import { BOX_STACK } from './furniture-sizes';
import { packLayout, type PackRoom, type PackUnit } from './layout-packer';
import type { ClientRef, MoveItemResponse } from './move-requests.service';

/** One physical thing to place: each unit of an item, boxes grouped in stacks. */
export function buildUnits(items: MoveItemResponse[]): PackUnit[] {
  return items.flatMap((item) => {
    const { widthCm, depthCm, stackable } = item.footprint;
    if (stackable) {
      const stacks = Math.ceil(item.quantity / BOX_STACK);
      return Array.from({ length: stacks }, (_, index) => {
        const inStack = Math.min(BOX_STACK, item.quantity - index * BOX_STACK);
        return {
          unitId: `${item.id}-stack-${index + 1}`,
          itemId: item.id,
          name: `${item.name} (stack of ${inStack})`,
          widthCm,
          depthCm,
        };
      });
    }
    return Array.from({ length: item.quantity }, (_, index) => ({
      unitId: `${item.id}-${index + 1}`,
      itemId: item.id,
      name: item.quantity > 1 ? `${item.name} #${index + 1}` : item.name,
      widthCm,
      depthCm,
    }));
  });
}

function toPackRooms(home: HomeDetailResponse): PackRoom[] {
  return home.rooms.map((room) => ({
    id: room.id,
    name: room.name,
    type: room.type,
    widthCm: room.widthCm,
    lengthCm: room.lengthCm,
    openings: room.openings,
  }));
}

/** Changes to rooms, doors, windows or items make a saved plan stale. */
function inputHash(rooms: PackRoom[], units: PackUnit[]) {
  return createHash('sha1').update(JSON.stringify({ rooms, units })).digest('hex');
}

export interface LayoutPlanResponse {
  homeId: string;
  moveReference: string;
  provider: LayoutPlanDoc['provider'];
  model: string;
  attempts: LayoutPlanDoc['attempts'];
  placements: LayoutPlanDoc['placements'];
  unplaced: LayoutPlanDoc['unplaced'];
  tips: string[];
  warnings: string[];
  /** True when the rooms or items changed after this plan was made. */
  stale: boolean;
  createdAt: string;
}

function serializePlan(plan: LayoutPlanDoc, currentHash: string | null): LayoutPlanResponse {
  return {
    homeId: plan.homeId,
    moveReference: plan.moveReference,
    provider: plan.provider,
    model: plan.model,
    attempts: plan.attempts.map(({ provider, model, ok, ms, error }) => ({
      provider,
      model,
      ok,
      ms,
      ...(error ? { error } : {}),
    })),
    placements: plan.placements.map((placement) => ({
      unitId: placement.unitId,
      itemId: placement.itemId,
      name: placement.name,
      roomId: placement.roomId,
      wall: placement.wall,
      x: placement.x,
      y: placement.y,
      w: placement.w,
      h: placement.h,
      reason: placement.reason,
      source: placement.source,
      ...(placement.requestedWall ? { requestedWall: placement.requestedWall } : {}),
    })),
    unplaced: plan.unplaced.map(({ unitId, itemId, name, roomId, reason }) => ({
      unitId,
      itemId,
      name,
      roomId: roomId ?? null,
      reason,
    })),
    tips: [...plan.tips],
    warnings: [...plan.warnings],
    stale: plan.inputHash !== currentHash,
    createdAt: plan.updatedAt.toISOString(),
  };
}

/** Smart Room Layout: AI room/wall choices → exact positions → saved plan. */
export class LayoutService {
  async generate(client: ClientRef, homeId: string): Promise<LayoutPlanResponse> {
    const home = await homesService.getMine(client, homeId);
    if (!home.moveRequest) throw new BadRequestError('Link a move request to this house first.');
    if (home.rooms.length === 0) throw new BadRequestError('Add at least one room first.');

    const rooms = toPackRooms(home);
    const units = buildUnits(home.moveRequest.items);
    // The AI sees short keys (R1, R2…): models mis-copy 24-char Mongo ids.
    const roomIdByKey = new Map(rooms.map((room, index) => [`R${index + 1}`, room.id]));
    const ai = await planWithAi(
      rooms.map((room, index) => ({
        id: `R${index + 1}`,
        name: room.name,
        type: room.type,
        widthCm: room.widthCm,
        lengthCm: room.lengthCm,
        doors: room.openings.filter((o) => o.kind === 'DOOR').map((o) => o.wall),
        windows: room.openings.filter((o) => o.kind === 'WINDOW').map((o) => o.wall),
      })),
      units.map(({ unitId, name, widthCm, depthCm }) => ({ unitId, name, widthCm, depthCm })),
    );
    const packed = packLayout(
      rooms,
      units,
      ai.layout.placements.map((choice) => ({
        ...choice,
        roomId: roomIdByKey.get(choice.roomId.trim().toUpperCase()) ?? choice.roomId,
      })),
    );
    const hash = inputHash(rooms, units);

    await connectMongo();
    const plan = await LayoutPlanModel.findOneAndUpdate(
      { homeId: home.id },
      {
        $set: {
          clientId: client.id,
          moveReference: home.moveRequest.reference,
          provider: ai.provider,
          model: ai.model,
          attempts: ai.attempts,
          placements: packed.placed,
          unplaced: packed.unplaced,
          tips: ai.layout.tips.slice(0, 4),
          warnings: packed.warnings,
          inputHash: hash,
        },
      },
      { upsert: true, returnDocument: 'after' },
    ).lean<LayoutPlanDoc>();
    if (!plan) throw new Error('Layout plan was not saved');
    return serializePlan(plan, hash);
  }

  async get(client: ClientRef, homeId: string): Promise<LayoutPlanResponse> {
    const home = await homesService.getMine(client, homeId);
    await connectMongo();
    const plan = await LayoutPlanModel.findOne({
      homeId: home.id,
      clientId: client.id,
    }).lean<LayoutPlanDoc>();
    if (!plan) throw new NotFoundError('Layout plan');
    const current = home.moveRequest
      ? inputHash(toPackRooms(home), buildUnits(home.moveRequest.items))
      : null;
    return serializePlan(plan, current);
  }

  async remove(client: ClientRef, homeId: string): Promise<{ deleted: true }> {
    const home = await homesService.getMine(client, homeId);
    await connectMongo();
    const { deletedCount } = await LayoutPlanModel.deleteOne({
      homeId: home.id,
      clientId: client.id,
    });
    if (!deletedCount) throw new NotFoundError('Layout plan');
    return { deleted: true };
  }
}

export const layoutService = new LayoutService();
