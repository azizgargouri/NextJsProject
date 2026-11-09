import type { RoomDto, Wall } from '@/types/homes';

/**
 * Client mirror of server/modules/room-layout/layout-packer.ts#spotProblem so a
 * drag shows green/red instantly. The server re-checks every drop and stays the
 * authority — keep these numbers in sync with the packer.
 */
const GAP_CM = 5;
const WINDOW_DEPTH_CM = 40;
const TALL = new Set(['fridge', 'wardrobe', 'bookshelf']);

/** Drops snap to this grid and stick to a wall when this close to it. */
export const SNAP_CM = 5;
export const WALL_MAGNET_CM = 15;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Rect, b: Rect, gap = 0) =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

function openingZone(room: RoomDto, opening: RoomDto['openings'][number]): Rect {
  const { widthCm: W, lengthCm: L } = room;
  const { kind, wall, offsetCm: o, widthCm: s } = opening;
  const d = kind === 'DOOR' ? s : WINDOW_DEPTH_CM;
  if (wall === 'N') return { x: o, y: 0, w: s, h: d };
  if (wall === 'S') return { x: o, y: L - d, w: s, h: d };
  if (wall === 'W') return { x: 0, y: o, w: d, h: s };
  return { x: W - d, y: o, w: d, h: s };
}

/** Why the spot is not allowed, or null when it is free. */
export function spotProblem(
  room: RoomDto,
  itemId: string,
  rect: Rect,
  others: { name: string; rect: Rect }[],
): string | null {
  if (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.x + rect.w > room.widthCm ||
    rect.y + rect.h > room.lengthCm
  ) {
    return `Outside ${room.name}.`;
  }
  for (const opening of room.openings) {
    if (opening.kind === 'WINDOW' && !TALL.has(itemId)) continue;
    if (overlaps(rect, openingZone(room, opening))) {
      return opening.kind === 'DOOR'
        ? 'Blocks the door.'
        : 'Too tall to stand in front of a window.';
    }
  }
  const hit = others.find((other) => overlaps(rect, other.rect, GAP_CM));
  return hit ? `Too close to ${hit.name}.` : null;
}

/**
 * Door/window drag: the wall nearest the pointer, and the offset that centres
 * an opening of `span` cm on it — snapped to the grid and kept on the wall.
 */
export function openingSpot(
  room: { widthCm: number; lengthCm: number },
  point: { x: number; y: number },
  span: number,
): { wall: Wall; offsetCm: number } | null {
  const { widthCm: W, lengthCm: L } = room;
  if (!(W > 0 && L > 0) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  // Distance to each wall segment (not its infinite line), so past a corner the wall you
  // dragged beyond wins; exactly diagonal from a corner, the first listed wins.
  const beyond = (value: number, max: number) => Math.max(-value, value - max, 0);
  const { x, y } = point;
  const distances: [Wall, number][] = [
    ['N', Math.hypot(beyond(x, W), y)],
    ['S', Math.hypot(beyond(x, W), L - y)],
    ['W', Math.hypot(x, beyond(y, L))],
    ['E', Math.hypot(W - x, beyond(y, L))],
  ];
  const [wall] = distances.reduce((best, next) => (next[1] < best[1] ? next : best));
  const wallLength = wall === 'N' || wall === 'S' ? W : L;
  const along = wall === 'N' || wall === 'S' ? point.x : point.y;
  const width = Number.isFinite(span) && span > 0 ? span : 0;
  const max = Math.max(wallLength - width, 0);
  const offset = Math.round((along - width / 2) / SNAP_CM) * SNAP_CM;
  return { wall, offsetCm: Math.min(Math.max(offset, 0), max) };
}

/** Keep the item inside the room, on the 5 cm grid, and flush to a wall when near it. */
export function snapRect(room: RoomDto, rect: Rect): Rect {
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), Math.max(max, 0));
  const snap = (value: number) => Math.round(value / SNAP_CM) * SNAP_CM;
  const maxX = room.widthCm - rect.w;
  const maxY = room.lengthCm - rect.h;
  let x = clamp(snap(rect.x), maxX);
  let y = clamp(snap(rect.y), maxY);
  if (x < WALL_MAGNET_CM) x = 0;
  if (maxX - x < WALL_MAGNET_CM) x = maxX;
  if (y < WALL_MAGNET_CM) y = 0;
  if (maxY - y < WALL_MAGNET_CM) y = maxY;
  return { ...rect, x, y };
}
