import type { OpeningKind, RoomType, Wall } from '../../shared/database/models/home.model';
import type { PlacementWall } from './ai/layout-prompt';

/**
 * Turns the AI's "room + wall" choices into exact, valid positions (cm, origin
 * = room's north-west corner, x → east, y → south). Guarantees: every placed
 * item is inside its room, overlaps nothing, and keeps every door's swing free.
 */
export interface PackRoom {
  id: string;
  name: string;
  type: RoomType;
  widthCm: number;
  lengthCm: number;
  openings: { kind: OpeningKind; wall: Wall; offsetCm: number; widthCm: number }[];
}

export interface PackUnit {
  unitId: string;
  itemId: string;
  name: string;
  /** Side that goes along the wall. */
  widthCm: number;
  /** Side that goes into the room. */
  depthCm: number;
}

export interface WallChoice {
  unitId: string;
  roomId: string;
  wall: PlacementWall;
  reason: string;
}

export interface PlacedUnit {
  unitId: string;
  itemId: string;
  name: string;
  roomId: string;
  wall: PlacementWall;
  /** Drawn extents: x/y of the top-left corner, w along x, h along y. */
  x: number;
  y: number;
  w: number;
  h: number;
  reason: string;
  source: 'ai' | 'moveup';
  /** Set when the requested wall had no room and another spot was used. */
  requestedWall?: PlacementWall;
}

export interface UnplacedUnit {
  unitId: string;
  itemId: string;
  name: string;
  roomId: string | null;
  reason: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GAP_CM = 5;
const STEP_CM = 5;
const CENTER_MARGIN_CM = 40;
const WINDOW_DEPTH_CM = 40;
const WALLS: Wall[] = ['N', 'E', 'S', 'W'];

/** Items that must stand against a wall, whatever the AI said. */
const WALL_ONLY = new Set(['fridge', 'washer', 'wardrobe', 'bookshelf', 'tv-stand']);
/** Tall items should not block a window. */
const TALL = new Set(['fridge', 'wardrobe', 'bookshelf']);

/** Where an item goes when the AI skipped it or named an unknown room. */
const DEFAULT_ROOMS: Record<string, RoomType[]> = {
  bed: ['BEDROOM', 'KIDS'],
  wardrobe: ['BEDROOM', 'KIDS'],
  sofa: ['LIVING'],
  'tv-stand': ['LIVING'],
  table: ['DINING', 'KITCHEN', 'LIVING'],
  chair: ['DINING', 'KITCHEN', 'LIVING'],
  fridge: ['KITCHEN'],
  washer: ['BATHROOM', 'KITCHEN'],
  desk: ['OFFICE', 'BEDROOM'],
  bookshelf: ['LIVING', 'OFFICE'],
  box: ['STORAGE'],
};

const overlaps = (a: Rect, b: Rect, gap = 0) =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

/** Door swing squares (+ window strips for tall items) that nothing may cover. */
function obstacles(room: PackRoom, tall: boolean): Rect[] {
  const { widthCm: W, lengthCm: L } = room;
  return room.openings
    .filter((opening) => opening.kind === 'DOOR' || tall)
    .map(({ kind, wall, offsetCm: o, widthCm: s }) => {
      const d = kind === 'DOOR' ? s : WINDOW_DEPTH_CM;
      if (wall === 'N') return { x: o, y: 0, w: s, h: d };
      if (wall === 'S') return { x: o, y: L - d, w: s, h: d };
      if (wall === 'W') return { x: 0, y: o, w: d, h: s };
      return { x: W - d, y: o, w: d, h: s };
    });
}

function fits(rect: Rect, room: PackRoom, blocked: Rect[], placed: Rect[]) {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.w <= room.widthCm &&
    rect.y + rect.h <= room.lengthCm &&
    !blocked.some((obstacle) => overlaps(rect, obstacle)) &&
    !placed.some((other) => overlaps(rect, other, GAP_CM))
  );
}

/** First free spot along a wall, back of the item against the wall. */
function onWall(unit: PackUnit, wall: Wall, room: PackRoom, blocked: Rect[], placed: Rect[]) {
  for (const [along, into] of [
    [unit.widthCm, unit.depthCm],
    [unit.depthCm, unit.widthCm],
  ] as const) {
    const horizontal = wall === 'N' || wall === 'S';
    const span = horizontal ? room.widthCm : room.lengthCm;
    for (let t = 0; t + along <= span; t += STEP_CM) {
      const rect: Rect = horizontal
        ? { x: t, y: wall === 'N' ? 0 : room.lengthCm - into, w: along, h: into }
        : { x: wall === 'W' ? 0 : room.widthCm - into, y: t, w: into, h: along };
      if (fits(rect, room, blocked, placed)) return rect;
    }
  }
  return null;
}

/** Free-standing spot closest to the room centre, keeping a walkway to the walls. */
function inCenter(unit: PackUnit, room: PackRoom, blocked: Rect[], placed: Rect[]) {
  const candidates: Rect[] = [];
  for (const [w, h] of [
    [unit.widthCm, unit.depthCm],
    [unit.depthCm, unit.widthCm],
  ] as const) {
    for (let x = CENTER_MARGIN_CM; x + w <= room.widthCm - CENTER_MARGIN_CM; x += STEP_CM) {
      for (let y = CENTER_MARGIN_CM; y + h <= room.lengthCm - CENTER_MARGIN_CM; y += STEP_CM) {
        candidates.push({ x, y, w, h });
      }
    }
  }
  const cx = room.widthCm / 2;
  const cy = room.lengthCm / 2;
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x + a.w / 2 - cx, a.y + a.h / 2 - cy) -
      Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy),
  );
  return candidates.find((rect) => fits(rect, room, blocked, placed)) ?? null;
}

/** Walls without a door first, then the longest. */
function wallOrder(room: PackRoom): Wall[] {
  const doors = (wall: Wall) =>
    room.openings.filter((opening) => opening.kind === 'DOOR' && opening.wall === wall).length;
  const length = (wall: Wall) => (wall === 'N' || wall === 'S' ? room.widthCm : room.lengthCm);
  return [...WALLS].sort((a, b) => doors(a) - doors(b) || length(b) - length(a));
}

function fallbackRoom(unit: PackUnit, rooms: PackRoom[]): PackRoom | null {
  const preferred = DEFAULT_ROOMS[unit.itemId] ?? [];
  const byArea = [...rooms].sort((a, b) => b.widthCm * b.lengthCm - a.widthCm * a.lengthCm);
  for (const type of preferred) {
    const room = byArea.find((candidate) => candidate.type === type);
    if (room) return room;
  }
  return byArea[0] ?? null;
}

export function packLayout(rooms: PackRoom[], units: PackUnit[], choices: WallChoice[]) {
  const placed: PlacedUnit[] = [];
  const unplaced: UnplacedUnit[] = [];
  const warnings: string[] = [];
  const takenByRoom = new Map<string, Rect[]>();
  const choiceOf = new Map<string, WallChoice>();
  for (const choice of choices)
    if (!choiceOf.has(choice.unitId)) choiceOf.set(choice.unitId, choice);

  // Biggest first: they have the fewest possible spots.
  const ordered = [...units].sort((a, b) => b.widthCm * b.depthCm - a.widthCm * a.depthCm);

  for (const unit of ordered) {
    const choice = choiceOf.get(unit.unitId);
    let room = choice ? rooms.find((candidate) => candidate.id === choice.roomId) : undefined;
    let source: PlacedUnit['source'] = 'ai';
    let reason = choice?.reason ?? '';

    if (!room) {
      room = fallbackRoom(unit, rooms) ?? undefined;
      source = 'moveup';
      reason = 'The assistant gave no usable room for this item, so MoveUp chose one.';
      warnings.push(
        `${unit.name}: the assistant gave no usable room; MoveUp chose ${room?.name ?? 'none'}.`,
      );
    }
    if (!room) {
      unplaced.push({ ...pick(unit), roomId: null, reason: 'The house has no rooms.' });
      continue;
    }

    const taken = takenByRoom.get(room.id) ?? [];
    const blocked = obstacles(room, TALL.has(unit.itemId));
    const wanted: PlacementWall =
      choice && source === 'ai' && !(choice.wall === 'CENTER' && WALL_ONLY.has(unit.itemId))
        ? choice.wall
        : wallOrder(room)[0]!;

    const tries: PlacementWall[] = [
      wanted,
      ...wallOrder(room).filter((wall) => wall !== wanted),
      ...(WALL_ONLY.has(unit.itemId) || wanted === 'CENTER' ? [] : (['CENTER'] as const)),
    ];

    let spot: { rect: Rect; wall: PlacementWall } | null = null;
    for (const wall of tries) {
      const rect =
        wall === 'CENTER'
          ? inCenter(unit, room, blocked, taken)
          : onWall(unit, wall, room, blocked, taken);
      if (rect) {
        spot = { rect, wall };
        break;
      }
    }

    if (!spot) {
      const tooBig =
        Math.min(unit.widthCm, unit.depthCm) > Math.min(room.widthCm, room.lengthCm) ||
        Math.max(unit.widthCm, unit.depthCm) > Math.max(room.widthCm, room.lengthCm);
      unplaced.push({
        ...pick(unit),
        roomId: room.id,
        reason: tooBig
          ? `Too big for ${room.name} (${unit.widthCm} × ${unit.depthCm} cm).`
          : `No free space left in ${room.name}.`,
      });
      continue;
    }

    taken.push(spot.rect);
    takenByRoom.set(room.id, taken);
    placed.push({
      ...pick(unit),
      roomId: room.id,
      wall: spot.wall,
      ...spot.rect,
      reason,
      source,
      ...(choice && source === 'ai' && spot.wall !== choice.wall
        ? { requestedWall: choice.wall }
        : {}),
    });
  }

  return { placed, unplaced, warnings };
}

const pick = (unit: PackUnit) => ({ unitId: unit.unitId, itemId: unit.itemId, name: unit.name });
