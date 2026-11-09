import { Schema, model, models, type Model, type Types } from 'mongoose';
import { VEHICLE_TYPES, type VehicleType } from '../enums';

export interface VehicleDoc {
  moverId: string;
  type: VehicleType;
  capacityM3: number;
  plate: string;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

const VehicleSchema = new Schema<VehicleDoc>(
  {
    moverId: { type: String, required: true, index: true },
    type: { type: String, enum: [...VEHICLE_TYPES], required: true },
    capacityM3: { type: Number, required: true, min: 0 },
    plate: { type: String, required: true, trim: true, uppercase: true },
  },
  { timestamps: true },
);

export const VehicleModel = (models.Vehicle ??
  model('Vehicle', VehicleSchema)) as Model<VehicleDoc>;
