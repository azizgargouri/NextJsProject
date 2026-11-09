import type { DatabaseEntity, QueryParams } from '@/types';

/** Smart Room Layout (Omar) — mirrors server/modules/homes response DTOs. */
export const HOME_TYPES = ['APARTMENT', 'VILLA', 'STUDIO', 'DUPLEX'] as const;
export type HomeType = (typeof HOME_TYPES)[number];

export const ROOM_TYPES = [
  'LIVING',
  'BEDROOM',
  'KITCHEN',
  'BATHROOM',
  'DINING',
  'OFFICE',
  'KIDS',
  'STORAGE',
  'BALCONY',
  'OTHER',
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const OPENING_KINDS = ['DOOR', 'WINDOW'] as const;
export type OpeningKind = (typeof OPENING_KINDS)[number];

export const WALLS = ['N', 'E', 'S', 'W'] as const;
export type Wall = (typeof WALLS)[number];

export const HOME_LIMITS = { homesPerClient: 10, roomsPerHome: 20, openingsPerRoom: 8 } as const;

export interface OpeningDto {
  id: string;
  kind: OpeningKind;
  wall: Wall;
  offsetCm: number;
  widthCm: number;
}

export interface RoomDto {
  id: string;
  name: string;
  type: RoomType;
  widthCm: number;
  lengthCm: number;
  notes: string;
  openings: OpeningDto[];
}

export interface HomeDto extends DatabaseEntity {
  label: string;
  city: string;
  type: HomeType;
  floor: number;
  hasElevator: boolean;
  notes: string;
  moveReference: string | null;
  rooms: RoomDto[];
  totalAreaM2: number;
}

export interface FootprintDto {
  widthCm: number;
  depthCm: number;
  stackable: boolean;
  source: 'catalogue' | 'estimated';
}

export interface MoveItemDto {
  id: string;
  name: string;
  quantity: number;
  volumeM3: number;
  weightKg: number;
  footprint: FootprintDto;
}

export interface LinkedMoveRequestDto {
  reference: string;
  pickupAddress: string;
  destinationAddress: string;
  moveDate: string;
  items: MoveItemDto[];
  totals: { itemCount: number; volumeM3: number; weightKg: number; floorM2: number };
}

/** Single-house responses (GET one + every mutation) carry the expanded move request. */
export interface HomeDetailDto extends HomeDto {
  moveRequest: LinkedMoveRequestDto | null;
}

/** Entry of the link picker: one of the client's move requests. */
export interface ClientMoveRequestDto {
  reference: string;
  pickupAddress: string;
  destinationAddress: string;
  moveDate: string;
  itemCount: number;
  linkedHome: { id: string; label: string } | null;
}

export interface HomePayload {
  label: string;
  city: string;
  type: HomeType;
  floor: number;
  hasElevator: boolean;
  notes: string;
}

export type HomeUpdatePayload = Partial<HomePayload> & { moveReference?: string | null };

/** Moving boxes stack: the server counts them in stacks of this many. */
export const BOX_STACK = 3;

export interface RoomPayload {
  name: string;
  type: RoomType;
  widthCm: number;
  lengthCm: number;
  notes: string;
  openings: Omit<OpeningDto, 'id'>[];
}

export type HomesQuery = Pick<QueryParams, 'page' | 'limit' | 'search'>;

export type PlacementWall = Wall | 'CENTER';
export type LayoutProvider = 'ollama' | 'groq';

export interface LayoutPlacementDto {
  unitId: string;
  itemId: string;
  name: string;
  roomId: string;
  wall: PlacementWall;
  /** Drawn extents in cm inside the room (origin = north-west corner). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Turned 90° from normal (normal = width along the wall). */
  rotated: boolean;
  reason: string;
  /** ai = assistant, moveup = fallback room, client = moved by the client. */
  source: 'ai' | 'moveup' | 'client';
  /** Wall the AI asked for when it had no space and another spot was used. */
  requestedWall?: PlacementWall;
}

export interface LayoutPlanDto {
  homeId: string;
  moveReference: string;
  provider: LayoutProvider;
  model: string;
  attempts: { provider: LayoutProvider; model: string; ok: boolean; ms: number; error?: string }[];
  placements: LayoutPlacementDto[];
  unplaced: {
    unitId: string;
    itemId: string;
    name: string;
    roomId: string | null;
    reason: string;
    /** The client took it out (vs. no space was found). */
    removedByClient: boolean;
  }[];
  tips: string[];
  warnings: string[];
  /** Rooms or items changed after the plan was made. */
  stale: boolean;
  /** Items the client moved, rotated or took out (regenerate replaces them). */
  manualChanges: number;
  /** Rooms the client chose for given pieces before generating. */
  roomChoices: { unitId: string; roomId: string }[];
  createdAt: string;
}

/** One manual change; `move` also places an item that was left out. */
export type LayoutItemUpdatePayload =
  | { action: 'move'; unitId: string; roomId: string; wall: PlacementWall }
  | { action: 'place'; unitId: string; roomId: string; x: number; y: number; w: number; h: number }
  | { action: 'rotate'; unitId: string }
  | { action: 'remove'; unitId: string };
