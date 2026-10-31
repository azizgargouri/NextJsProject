import { Schema, model, models, type Model, type Types } from 'mongoose';

export const MOVE_STAGE_KEYS = [
  'CONFIRMED', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'LOADING', 'IN_TRANSIT', 'DELIVERY', 'COMPLETED',
] as const;
export type MoveStageKey = (typeof MOVE_STAGE_KEYS)[number];

export interface MoveStage {
  key: MoveStageKey;
  title: string;
  detail: string;
  durationMinutes: number | null;
  estimatedAt: Date;
  completedAt: Date | null;
}

export interface MoveDoc {
  reference: string;
  clientId: string;
  trackingToken: string;
  pickupAddress: string;
  destinationAddress: string;
  items: { id: string; name: string; volume: number; weight: number; quantity: number }[];
  volume: number;
  distance: number;
  estimatedPrice: number;
  vehicle: { name: string; capacity: number; payload: number };
  mover: { userId: string; name: string; phone: string; companyName: string };
  currentStage: MoveStageKey;
  stages: MoveStage[];
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

const StageSchema = new Schema<MoveStage>(
  {
    key: { type: String, enum: [...MOVE_STAGE_KEYS], required: true },
    title: { type: String, required: true },
    detail: { type: String, required: true },
    durationMinutes: { type: Number, default: null },
    estimatedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
  },
  { _id: false },
);

const MoveSchema = new Schema<MoveDoc>(
  {
    reference: { type: String, required: true, unique: true, index: true },
    clientId: { type: String, required: true, index: true },
    trackingToken: { type: String, required: true, unique: true, index: true, select: false },
    pickupAddress: { type: String, required: true },
    destinationAddress: { type: String, required: true },
    items: { type: [{ id: String, name: String, volume: Number, weight: Number, quantity: Number }], default: [] },
    volume: { type: Number, required: true },
    distance: { type: Number, required: true },
    estimatedPrice: { type: Number, required: true },
    vehicle: { name: { type: String, required: true }, capacity: { type: Number, required: true }, payload: { type: Number, required: true } },
    mover: {
      userId: { type: String, required: true },
      name: { type: String, required: true },
      phone: { type: String, required: true },
      companyName: { type: String, required: true },
    },
    currentStage: { type: String, enum: [...MOVE_STAGE_KEYS], required: true },
    stages: { type: [StageSchema], required: true },
  },
  { timestamps: true },
);

export const MoveModel = (models.Move ?? model('Move', MoveSchema)) as Model<MoveDoc>;
