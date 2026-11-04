import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * LayoutPlan — the latest AI furniture plan for one house (Smart Room Layout).
 * One plan per house: regenerating replaces it. Positions are in cm inside the
 * room (origin = north-west corner).
 */
export interface LayoutPlacementDoc {
  unitId: string;
  itemId: string;
  name: string;
  roomId: string;
  wall: 'N' | 'E' | 'S' | 'W' | 'CENTER';
  x: number;
  y: number;
  w: number;
  h: number;
  reason: string;
  source: 'ai' | 'moveup';
  requestedWall?: 'N' | 'E' | 'S' | 'W' | 'CENTER';
}

export interface LayoutUnplacedDoc {
  unitId: string;
  itemId: string;
  name: string;
  roomId: string | null;
  reason: string;
}

export interface LayoutAttemptDoc {
  provider: 'ollama' | 'groq';
  model: string;
  ok: boolean;
  ms: number;
  error?: string;
}

export interface LayoutPlanDoc {
  _id: Types.ObjectId;
  homeId: string;
  clientId: string;
  moveReference: string;
  provider: 'ollama' | 'groq';
  model: string;
  attempts: LayoutAttemptDoc[];
  placements: LayoutPlacementDoc[];
  unplaced: LayoutUnplacedDoc[];
  tips: string[];
  warnings: string[];
  inputHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const WALL_VALUES = ['N', 'E', 'S', 'W', 'CENTER'];

const LayoutPlanSchema = new Schema<LayoutPlanDoc>(
  {
    homeId: { type: String, required: true, unique: true, index: true },
    clientId: { type: String, required: true, index: true },
    moveReference: { type: String, required: true },
    provider: { type: String, enum: ['ollama', 'groq'], required: true },
    model: { type: String, required: true },
    attempts: {
      type: [
        new Schema<LayoutAttemptDoc>(
          {
            provider: { type: String, required: true },
            model: { type: String, default: '' },
            ok: { type: Boolean, required: true },
            ms: { type: Number, required: true },
            error: { type: String },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    placements: {
      type: [
        new Schema<LayoutPlacementDoc>(
          {
            unitId: { type: String, required: true },
            itemId: { type: String, required: true },
            name: { type: String, required: true },
            roomId: { type: String, required: true },
            wall: { type: String, enum: WALL_VALUES, required: true },
            x: { type: Number, required: true },
            y: { type: Number, required: true },
            w: { type: Number, required: true },
            h: { type: Number, required: true },
            reason: { type: String, default: '' },
            source: { type: String, enum: ['ai', 'moveup'], required: true },
            requestedWall: { type: String, enum: WALL_VALUES },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    unplaced: {
      type: [
        new Schema<LayoutUnplacedDoc>(
          {
            unitId: { type: String, required: true },
            itemId: { type: String, required: true },
            name: { type: String, required: true },
            roomId: { type: String, default: null },
            reason: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    tips: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
    inputHash: { type: String, required: true },
  },
  { timestamps: true },
);

export const LayoutPlanModel = (models.LayoutPlan ??
  model('LayoutPlan', LayoutPlanSchema)) as Model<LayoutPlanDoc>;
