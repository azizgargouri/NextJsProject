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
  rooms: RoomDto[];
  totalAreaM2: number;
}

export interface HomePayload {
  label: string;
  city: string;
  type: HomeType;
  floor: number;
  hasElevator: boolean;
  notes: string;
}

export interface RoomPayload {
  name: string;
  type: RoomType;
  widthCm: number;
  lengthCm: number;
  notes: string;
  openings: Omit<OpeningDto, 'id'>[];
}

export type HomesQuery = Pick<QueryParams, 'page' | 'limit' | 'search'>;
