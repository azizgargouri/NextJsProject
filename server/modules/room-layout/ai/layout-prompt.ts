import { z } from 'zod';
import type { RoomType, Wall } from '../../../shared/database/models/home.model';

export const PLACEMENT_WALLS = ['N', 'E', 'S', 'W', 'CENTER'] as const;
export type PlacementWall = (typeof PLACEMENT_WALLS)[number];

/**
 * What the AI must answer: a room + wall per unit and a short reason. Exact
 * coordinates are computed by layout-packer.ts — small models are poor at
 * geometry, good at "the bed goes against the north wall of the bedroom".
 */
export const AiLayoutSchema = z.strictObject({
  placements: z.array(
    z.strictObject({
      unitId: z.string(),
      roomId: z.string(),
      wall: z.enum(PLACEMENT_WALLS),
      reason: z.string(),
    }),
  ),
  tips: z.array(z.string()),
});

export type AiLayout = z.infer<typeof AiLayoutSchema>;

/** JSON Schema handed to Ollama (`format`) and Groq (`response_format.json_schema`). */
export const AI_LAYOUT_JSON_SCHEMA = z.toJSONSchema(AiLayoutSchema) as Record<string, unknown>;

export interface PlannerRoom {
  id: string;
  name: string;
  type: RoomType;
  widthCm: number;
  lengthCm: number;
  doors: Wall[];
  windows: Wall[];
}

export interface PlannerUnit {
  unitId: string;
  name: string;
  widthCm: number;
  depthCm: number;
  /** Room the client chose for this piece; the planner only picks the wall. */
  room?: string;
}

const SYSTEM_PROMPT = `You are the furniture layout planner of MoveUp, a moving company.
A client is moving into a new home. For EVERY unit, choose the room it goes to and where it stands:
"N", "E", "S" or "W" = against that wall (N is the top of the plan), or "CENTER" = free-standing.

Rules:
- Beds and wardrobes go to bedrooms (or kids rooms); put a bed's head against a wall without a door.
- Sofa and TV stand go to the living room, on opposite walls so the sofa faces the TV.
- Fridge goes to the kitchen. Washing machine goes to the bathroom, otherwise the kitchen.
- Dining table and its chairs stay together (dining room, else kitchen, else living room); use CENTER for them.
- A desk goes to an office or a bedroom, preferably on a wall with a window.
- Moving boxes go to the storage room, otherwise the largest room.
- Fridge, washing machine, wardrobe, bookshelf and TV stand always stand against a wall, never CENTER.
- Avoid the wall that has the room's door when another wall works. Keep big items on long walls.
- A unit with a "room" was put there by the client: use exactly that roomId and only choose the wall.
- Use only the roomId and unitId values given. Place every unit exactly once.
- "reason": one short sentence (max 15 words) a client understands.
- "tips": 2 to 4 short practical tips for move-in day.`;

export function buildLayoutMessages(rooms: PlannerRoom[], units: PlannerUnit[]) {
  const user = JSON.stringify({
    rooms: rooms.map((room) => ({
      roomId: room.id,
      name: room.name,
      type: room.type,
      sizeCm: `${room.widthCm} wide (W→E) x ${room.lengthCm} long (N→S)`,
      doorsOnWalls: room.doors,
      windowsOnWalls: room.windows,
    })),
    units: units.map((unit) => ({
      unitId: unit.unitId,
      name: unit.name,
      footprintCm: `${unit.widthCm} x ${unit.depthCm}`,
      ...(unit.room ? { room: unit.room } : {}),
    })),
  });
  return { system: SYSTEM_PROMPT, user };
}
