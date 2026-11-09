import { Schema, model, models, type Model, type Types } from 'mongoose';
import {
  TRACKING_SESSION_STATUSES,
  type TrackingSessionStatus,
} from '../enums';
import { TRACKING_INTERVAL_MINUTES } from '../../tracking';

/**
 * One tracking window per employee per work day. Check-in opens it; the optional
 * stop endpoint closes it. Location pings reference the session so history can
 * cap each sample to the configured interval.
 */
export interface TrackingSessionDoc {
  organization: Types.ObjectId;
  employee: Types.ObjectId;
  attendance: Types.ObjectId;
  crew: Types.ObjectId | null;
  /** Crew name snapshot so history survives later crew edits. */
  crewName: string | null;
  workDate: Date;
  startedAt: Date;
  endedAt: Date | null;
  lastPingAt: Date | null;
  pingCount: number;
  intervalMinutes: number;
  status: TrackingSessionStatus;
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

const TrackingSessionSchema = new Schema<TrackingSessionDoc>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    attendance: { type: Schema.Types.ObjectId, ref: 'Attendance', required: true },
    crew: { type: Schema.Types.ObjectId, ref: 'Crew', default: null },
    crewName: { type: String, trim: true, default: null },
    workDate: { type: Date, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    lastPingAt: { type: Date, default: null },
    pingCount: { type: Number, min: 0, default: 0 },
    intervalMinutes: { type: Number, min: 1, default: TRACKING_INTERVAL_MINUTES },
    status: {
      type: String,
      enum: [...TRACKING_SESSION_STATUSES],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true },
);

// A check-in can be pressed repeatedly; it must still map to one session/day.
TrackingSessionSchema.index({ employee: 1, workDate: 1 }, { unique: true });
TrackingSessionSchema.index({ organization: 1, employee: 1, workDate: 1 });
TrackingSessionSchema.index({ employee: 1, status: 1 });

export const TrackingSessionModel = (models.TrackingSession ??
  model('TrackingSession', TrackingSessionSchema)) as Model<TrackingSessionDoc>;
