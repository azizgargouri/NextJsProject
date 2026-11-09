import { createHash } from 'node:crypto';
import { connectMongo } from '../../shared/database/mongoose';
import {
  BadRequestError,
  DomainError,
  NotFoundError,
  ValidationError,
} from '../../shared/database/errors';
import {
  LayoutPlanModel,
  type LayoutPlacementDoc,
  type LayoutPlanDoc,
  type LayoutUnplacedDoc,
} from '../../shared/database/models/layout-plan.model';
import type { HomeDetailResponse } from '../homes/homes.serializer';
import { homesService } from '../homes/homes.service';
import { planWithAi } from './ai/layout-ai';
import { BOX_STACK } from './furniture-sizes';
import {
  describeSpot,
  packLayout,
  placeUnit,
  spotProblem,
  type Orientation,
  type PackRoom,
  type PackUnit,
  type Rect,
} from './layout-packer';
import { buildLayoutUnits } from '../../../lib/room-layout/units';
import type { LayoutGenerateInput, LayoutItemUpdateInput } from './layout.schema';
import type { ClientRef, MoveItemResponse } from './move-requests.service';

/** One physical thing to place: each unit of an item, boxes grouped in stacks. */
export function buildUnits(items: MoveItemResponse[]): PackUnit[] {
  return buildLayoutUnits(items, BOX_STACK);
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

const WALL_NAMES = { N: 'north', E: 'east', S: 'south', W: 'west' } as const;

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
  /** Items the client moved, rotated or took out (regenerate would replace them). */
  manualChanges: number;
  /** Rooms the client chose for given pieces before generating. */
  roomChoices: { unitId: string; roomId: string }[];
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
      rotated: placement.rotated ?? false,
      reason: placement.reason,
      source: placement.source,
      ...(placement.requestedWall ? { requestedWall: placement.requestedWall } : {}),
    })),
    unplaced: plan.unplaced.map(({ unitId, itemId, name, roomId, reason, removedByClient }) => ({
      unitId,
      itemId,
      name,
      roomId: roomId ?? null,
      reason,
      removedByClient: removedByClient ?? false,
    })),
    tips: [...plan.tips],
    warnings: [...plan.warnings],
    stale: plan.inputHash !== currentHash,
    manualChanges:
      plan.placements.filter((placement) => placement.source === 'client').length +
      plan.unplaced.filter((unit) => unit.removedByClient).length,
    roomChoices: (plan.roomChoices ?? []).map(({ unitId, roomId }) => ({ unitId, roomId })),
    createdAt: plan.updatedAt.toISOString(),
  };
}

/** Smart Room Layout: AI room/wall choices → exact positions → saved plan. */
export class LayoutService {
  async generate(
    client: ClientRef,
    homeId: string,
    input: LayoutGenerateInput = { roomChoices: [] },
  ): Promise<LayoutPlanResponse> {
    const home = await homesService.getMine(client, homeId);
    if (!home.moveRequest) throw new BadRequestError('Link a move request to this house first.');
    if (home.rooms.length === 0) throw new BadRequestError('Add at least one room first.');

    const rooms = toPackRooms(home);
    const units = buildUnits(home.moveRequest.items);
    const roomChoices = this.checkRoomChoices(rooms, units, input.roomChoices);
    const fixedRoom = new Map(roomChoices.map((choice) => [choice.unitId, choice.roomId]));
    const keyByRoomId = new Map(rooms.map((room, index) => [room.id, `R${index + 1}`]));
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
      units.map(({ unitId, name, widthCm, depthCm }) => {
        const fixed = fixedRoom.get(unitId);
        return {
          unitId,
          name,
          widthCm,
          depthCm,
          ...(fixed ? { room: keyByRoomId.get(fixed) } : {}),
        };
      }),
    );
    // The client's room choices are binding: the assistant only picks the wall there.
    const choices = ai.layout.placements.map((choice) => ({
      ...choice,
      roomId:
        fixedRoom.get(choice.unitId) ??
        roomIdByKey.get(choice.roomId.trim().toUpperCase()) ??
        choice.roomId,
    }));
    for (const [unitId, roomId] of fixedRoom) {
      if (!choices.some((choice) => choice.unitId === unitId)) {
        choices.push({ unitId, roomId, wall: 'N', reason: 'In the room you chose.' });
      }
    }
    const packed = packLayout(rooms, units, choices);
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
          roomChoices,
          inputHash: hash,
        },
      },
      { upsert: true, returnDocument: 'after' },
    ).lean<LayoutPlanDoc>();
    if (!plan) throw new Error('Layout plan was not saved');
    return serializePlan(plan, hash);
  }

  /** Keeps choices for pieces of this request; a room that is not in this house is an error. */
  private checkRoomChoices(
    rooms: PackRoom[],
    units: PackUnit[],
    roomChoices: LayoutGenerateInput['roomChoices'],
  ) {
    const roomIds = new Set(rooms.map((room) => room.id));
    const unitIds = new Set(units.map((unit) => unit.unitId));
    const kept = new Map<string, string>();
    for (const { unitId, roomId } of roomChoices) {
      if (!roomIds.has(roomId)) {
        throw new ValidationError('One of the chosen rooms is no longer in this house.');
      }
      if (unitIds.has(unitId)) kept.set(unitId, roomId);
    }
    return [...kept].map(([unitId, roomId]) => ({ unitId, roomId }));
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

  /** Client edit of one item: move by menu, place by drag-and-drop, rotate 90°, or take out. */
  async updateItem(
    client: ClientRef,
    homeId: string,
    input: LayoutItemUpdateInput,
  ): Promise<LayoutPlanResponse> {
    const home = await homesService.getMine(client, homeId);
    await connectMongo();
    const plan = await LayoutPlanModel.findOne({
      homeId: home.id,
      clientId: client.id,
    }).lean<LayoutPlanDoc>();
    if (!plan) throw new NotFoundError('Layout plan');

    const rooms = toPackRooms(home);
    const units = home.moveRequest ? buildUnits(home.moveRequest.items) : [];
    const unit = units.find((candidate) => candidate.unitId === input.unitId);
    if (!unit) {
      throw new DomainError(
        'This item is no longer in your move request. Regenerate the layout.',
        409,
        'LAYOUT_ITEM_GONE',
      );
    }

    const current = plan.placements.find((placement) => placement.unitId === unit.unitId);
    let placements: LayoutPlacementDoc[] = plan.placements;
    let unplaced: LayoutUnplacedDoc[] = plan.unplaced.filter((u) => u.unitId !== unit.unitId);
    // Keep an edited item's position in the list so its number does not change.
    const upsert = (updated: LayoutPlacementDoc) =>
      current
        ? plan.placements.map((placement) =>
            placement.unitId === unit.unitId ? updated : placement,
          )
        : [...plan.placements, updated];

    if (input.action === 'remove') {
      if (!current) throw new BadRequestError(`${unit.name} is not in the layout.`);
      placements = plan.placements.filter((placement) => placement.unitId !== unit.unitId);
      unplaced = [
        ...unplaced,
        {
          unitId: unit.unitId,
          itemId: unit.itemId,
          name: unit.name,
          roomId: current.roomId,
          reason: 'Taken out of the layout by you.',
          removedByClient: true,
        },
      ];
    } else if (input.action === 'place') {
      const room = rooms.find((candidate) => candidate.id === input.roomId);
      if (!room) throw new NotFoundError('Room');
      const rect = { x: input.x, y: input.y, w: input.w, h: input.h };
      const sameSize =
        (rect.w === unit.widthCm && rect.h === unit.depthCm) ||
        (rect.w === unit.depthCm && rect.h === unit.widthCm);
      if (!sameSize) {
        throw new ValidationError(`${unit.name} is ${unit.widthCm} × ${unit.depthCm} cm.`);
      }
      const others = plan.placements
        .filter((placement) => placement.roomId === room.id && placement.unitId !== unit.unitId)
        .map(({ name, x, y, w, h }) => ({ name, rect: { x, y, w, h } }));
      const problem = spotProblem(room, unit, rect, others);
      if (problem) {
        throw new DomainError(`${unit.name} can't go there: ${problem}`, 409, 'LAYOUT_NO_SPACE');
      }
      placements = upsert({
        unitId: unit.unitId,
        itemId: unit.itemId,
        name: unit.name,
        roomId: room.id,
        ...describeSpot(room, unit, rect),
        ...rect,
        reason: 'Placed here by you.',
        source: 'client',
      });
    } else {
      if (input.action === 'rotate' && !current) {
        throw new BadRequestError(`${unit.name} is not in the layout.`);
      }
      const roomId = input.action === 'rotate' ? current!.roomId : input.roomId;
      const wall = input.action === 'rotate' ? current!.wall : input.wall;
      const room = rooms.find((candidate) => candidate.id === roomId);
      if (!room) throw new NotFoundError('Room');

      const keep: Orientation = current?.rotated ? 'rotated' : 'normal';
      const flip: Orientation = keep === 'normal' ? 'rotated' : 'normal';
      const sameSpot = current && current.roomId === room.id && current.wall === wall;
      const taken: Rect[] = plan.placements
        .filter((placement) => placement.roomId === room.id && placement.unitId !== unit.unitId)
        .map(({ x, y, w, h }) => ({ x, y, w, h }));

      const spot = placeUnit(room, unit, wall, taken, {
        orientations: input.action === 'rotate' ? [flip] : [keep, flip],
        near: sameSpot ? { x: current.x + current.w / 2, y: current.y + current.h / 2 } : undefined,
      });
      if (!spot) {
        throw new DomainError(
          input.action === 'rotate'
            ? `Not enough space to turn ${unit.name} where it stands.`
            : `No free space for ${unit.name} ${
                wall === 'CENTER' ? 'in the middle of' : `on the ${WALL_NAMES[wall]} wall of`
              } ${room.name}.`,
          409,
          'LAYOUT_NO_SPACE',
        );
      }

      placements = upsert({
        unitId: unit.unitId,
        itemId: unit.itemId,
        name: unit.name,
        roomId: room.id,
        wall,
        ...spot.rect,
        rotated: spot.rotated,
        reason: input.action === 'rotate' && current ? current.reason : 'Placed here by you.',
        source: 'client',
      });
    }

    const saved = await LayoutPlanModel.findOneAndUpdate(
      { _id: plan._id },
      { $set: { placements, unplaced } },
      { returnDocument: 'after' },
    ).lean<LayoutPlanDoc>();
    if (!saved) throw new NotFoundError('Layout plan');
    return serializePlan(saved, home.moveRequest ? inputHash(rooms, units) : null);
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
