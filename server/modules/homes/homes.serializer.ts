import type { LinkedMoveRequestResponse } from '../room-layout/move-requests.service';
import type { HomeRow, RoomRow } from './homes.repository';

/** Whitelisted house response — never exposes clientId or soft-delete internals. */
export interface HomeResponse {
  id: string;
  label: string;
  city: string;
  type: HomeRow['type'];
  floor: number;
  hasElevator: boolean;
  notes: string;
  moveReference: string | null;
  rooms: RoomRow[];
  totalAreaM2: number;
  createdAt: string;
  updatedAt: string;
}

export function serializeHome(home: HomeRow): HomeResponse {
  const totalAreaCm2 = home.rooms.reduce((sum, room) => sum + room.widthCm * room.lengthCm, 0);
  return {
    id: home.id,
    label: home.label,
    city: home.city,
    type: home.type,
    floor: home.floor,
    hasElevator: home.hasElevator,
    notes: home.notes,
    moveReference: home.moveReference,
    rooms: home.rooms,
    totalAreaM2: Math.round(totalAreaCm2 / 1000) / 10, // cm² → m², one decimal
    createdAt: home.createdAt.toISOString(),
    updatedAt: home.updatedAt.toISOString(),
  };
}

/** Single-house response: also carries the linked move request with item footprints. */
export interface HomeDetailResponse extends HomeResponse {
  /** null when nothing is linked, or when the linked request is no longer available. */
  moveRequest: LinkedMoveRequestResponse | null;
}
