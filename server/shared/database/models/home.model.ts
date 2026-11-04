import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * Home document — the client's NEW house (Smart Room Layout feature).
 * Rooms and their openings are embedded: they are always read and edited
 * together with the house and never shared between houses.
 *
 * Geometry: a room's origin is its north-west corner, x grows east up to
 * `widthCm`, y grows south up to `lengthCm`. Opening offsets start at the
 * west corner for N/S walls and at the north corner for E/W walls.
 */
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

export interface OpeningDoc {
  _id: Types.ObjectId;
  kind: OpeningKind;
  wall: Wall;
  offsetCm: number;
  widthCm: number;
}

export interface RoomDoc {
  _id: Types.ObjectId;
  name: string;
  type: RoomType;
  widthCm: number;
  lengthCm: number;
  notes: string;
  openings: OpeningDoc[];
}

export interface HomeDoc {
  _id: Types.ObjectId;
  clientId: string;
  label: string;
  city: string;
  type: HomeType;
  floor: number;
  hasElevator: boolean;
  notes: string;
  rooms: RoomDoc[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const OpeningSchema = new Schema<OpeningDoc>({
  kind: { type: String, enum: [...OPENING_KINDS], required: true },
  wall: { type: String, enum: [...WALLS], required: true },
  offsetCm: { type: Number, required: true, min: 0 },
  widthCm: { type: Number, required: true, min: 1 },
});

const RoomSchema = new Schema<RoomDoc>({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: [...ROOM_TYPES], required: true },
  widthCm: { type: Number, required: true, min: 1 },
  lengthCm: { type: Number, required: true, min: 1 },
  notes: { type: String, default: '' },
  openings: { type: [OpeningSchema], default: [] },
});

const HomeSchema = new Schema<HomeDoc>(
  {
    clientId: { type: String, required: true, index: true },
    label: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    type: { type: String, enum: [...HOME_TYPES], required: true },
    floor: { type: Number, default: 0, min: 0 },
    hasElevator: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    rooms: { type: [RoomSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

HomeSchema.index({ clientId: 1, deletedAt: 1, createdAt: -1 });

export const HomeModel = (models.Home ?? model('Home', HomeSchema)) as Model<HomeDoc>;
