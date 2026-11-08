import { Schema, model, models, type Model, type Types } from 'mongoose';
import {
  LOCATION_PING_SOURCES,
  type LocationPingSource,
} from '../enums';

/**
 * A single geolocation sample. The server owns `at` (arrival time) so clients
 * cannot backdate a track; the heatmap later weights it by the gap to the next
 * sample, capped at the session interval.
 */
export interface LocationPingDoc {
  organization: Types.ObjectId;
  employee: Types.ObjectId;
  attendance: Types.ObjectId;
  session: Types.ObjectId;
  crew: Types.ObjectId | null;
  /** Crew name snapshot at ping time. */
  crewName: string | null;
  at: Date;
  lat: number;
  lng: number;
  accuracy: number | null;
  source: LocationPingSource;
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

const LocationPingSchema = new Schema<LocationPingDoc>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    attendance: { type: Schema.Types.ObjectId, ref: 'Attendance', required: true },
    session: { type: Schema.Types.ObjectId, ref: 'TrackingSession', required: true },
    crew: { type: Schema.Types.ObjectId, ref: 'Crew', default: null },
    crewName: { type: String, trim: true, default: null },
    at: { type: Date, required: true },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    accuracy: { type: Number, min: 0, default: null },
    source: {
      type: String,
      enum: [...LOCATION_PING_SOURCES],
      default: 'interval',
    },
  },
  { timestamps: true },
);

// History is always "one employee over a time window", newest last.
LocationPingSchema.index({ employee: 1, at: 1 });
LocationPingSchema.index({ organization: 1, employee: 1, at: 1 });
LocationPingSchema.index({ session: 1, at: 1 });

export const LocationPingModel = (models.LocationPing ??
  model('LocationPing', LocationPingSchema)) as Model<LocationPingDoc>;
