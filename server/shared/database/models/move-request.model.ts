import { Schema, model, models, type Model, type Types } from 'mongoose';
import {
  MOVE_STATUSES,
  PROGRESS_STAGES,
  TIME_SLOTS,
  type MoveStatus,
  type ProgressStage,
  type TimeSlot,
} from '../enums';

export interface MoveAddress {
  street: string;
  city: string;
  /** Service zone code matched against MoverProfile.zones, e.g. "TUN". */
  zone: string;
  postalCode: string;
  floor: number;
  hasElevator: boolean;
  accessNotes: string;
}

export interface MoveItem {
  name: string;
  quantity: number;
  category: string;
  isFragile: boolean;
  needsDisassembly: boolean;
  /** Client inventory metadata retained through dispatch and completion. */
  volume?: number;
  weight?: number;
  room?: string;
}

/** What the mover recorded and confirmed once the vehicle was loaded. */
export interface MoveLoadCheck {
  boxes: number;
  furniture: number;
  note: string;
  confirmedAt: Date;
  confirmedBy: string;
}

/**
 * MoveRequest document (spec ch.7): one client creates it, movers quote on it,
 * exactly one mover is assigned. Stored in `moverequests`, separate from the
 * `moves` collection used by the unmerged requests-and-inventory branch.
 */
export interface MoveRequestDoc {
  reference: string;
  clientId: string;
  pickup: MoveAddress;
  dropoff: MoveAddress;
  /** Calendar day as YYYY-MM-DD, so a move never shifts across time zones. */
  moveDate: string;
  timeSlot: TimeSlot;
  housingType: string;
  sizeRooms: number;
  volumeM3: number;
  extraServices: string[];
  notes: string;
  items: MoveItem[];
  status: MoveStatus;
  progressStage: ProgressStage | null;
  loadCheck: MoveLoadCheck | null;
  /** When set, a mover may accept this price directly instead of quoting. */
  estimatedPrice: number | null;
  finalPrice: number | null;
  assignedMoverId: string | null;
  assignedAt: Date | null;
  deliveredAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

const AddressSchema = new Schema<MoveAddress>(
  {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    zone: { type: String, required: true, uppercase: true, trim: true },
    postalCode: { type: String, default: '', trim: true },
    floor: { type: Number, default: 0 },
    hasElevator: { type: Boolean, default: false },
    accessNotes: { type: String, default: '' },
  },
  { _id: false },
);

const ItemSchema = new Schema<MoveItem>(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    category: { type: String, default: '' },
    isFragile: { type: Boolean, default: false },
    needsDisassembly: { type: Boolean, default: false },
    volume: { type: Number, default: 0, min: 0 },
    weight: { type: Number, default: 0, min: 0 },
    room: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const LoadCheckSchema = new Schema<MoveLoadCheck>(
  {
    boxes: { type: Number, required: true, min: 0 },
    furniture: { type: Number, required: true, min: 0 },
    note: { type: String, default: '' },
    confirmedAt: { type: Date, required: true },
    confirmedBy: { type: String, required: true },
  },
  { _id: false },
);

const MoveRequestSchema = new Schema<MoveRequestDoc>(
  {
    reference: { type: String, required: true, unique: true },
    clientId: { type: String, required: true, index: true },
    pickup: { type: AddressSchema, required: true },
    dropoff: { type: AddressSchema, required: true },
    moveDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    timeSlot: { type: String, enum: [...TIME_SLOTS], required: true },
    housingType: { type: String, default: '' },
    sizeRooms: { type: Number, default: 0, min: 0 },
    volumeM3: { type: Number, default: 0, min: 0 },
    extraServices: { type: [String], default: [] },
    notes: { type: String, default: '' },
    items: { type: [ItemSchema], default: [] },
    status: { type: String, enum: [...MOVE_STATUSES], default: 'SUBMITTED', index: true },
    progressStage: { type: String, enum: [...PROGRESS_STAGES, null], default: null },
    loadCheck: { type: LoadCheckSchema, default: null },
    estimatedPrice: { type: Number, default: null, min: 0 },
    finalPrice: { type: Number, default: null, min: 0 },
    assignedMoverId: { type: String, default: null, index: true },
    assignedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const MoveRequestModel = (models.MoveRequest ??
  model('MoveRequest', MoveRequestSchema)) as Model<MoveRequestDoc>;
