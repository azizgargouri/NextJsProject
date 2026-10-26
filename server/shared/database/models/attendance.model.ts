import { Schema, model, models, type Model, type Types } from 'mongoose';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '../enums';

/** Geo fix captured at check-in time (browser geolocation). */
export interface AttendanceLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

/** Attendance document — one row per employee per work day (unique index). */
export interface AttendanceDoc {
  id: string;
  employee: Types.ObjectId;
  workDate: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  status: AttendanceStatus;
  breakDuration: number;
  location: AttendanceLocation | null;
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

const AttendanceSchema = new Schema<AttendanceDoc>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    workDate: { type: Date, required: true },
    clockIn: { type: Date },
    clockOut: { type: Date },
    status: { type: String, enum: [...ATTENDANCE_STATUSES], default: 'present' },
    breakDuration: { type: Number, min: 0, default: 0 },
    location: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
      accuracy: { type: Number, min: 0 },
    },
  },
  { timestamps: true },
);

// Fast per-employee per-day lookups; also guards the check-in race.
AttendanceSchema.index({ employee: 1, workDate: 1 }, { unique: true });

export const AttendanceModel = (models.Attendance ??
  model('Attendance', AttendanceSchema)) as Model<AttendanceDoc>;
