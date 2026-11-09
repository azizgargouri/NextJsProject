import { Schema, model, models, type Model, type Types } from 'mongoose';
import { LEAVE_STATUSES, LEAVE_TYPES, type LeaveStatus, type LeaveType } from '../enums';

/** Leave request document — submitted by an employee, decided by HR. */
export interface LeaveRequestDoc {
  id: string;
  employee: Types.ObjectId;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  daysRequested: number;
  status: LeaveStatus;
  reason: string | null;
  approvedBy: Types.ObjectId | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

const LeaveRequestSchema = new Schema<LeaveRequestDoc>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    type: { type: String, enum: [...LEAVE_TYPES], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    daysRequested: { type: Number, required: true, min: 0 },
    status: { type: String, enum: [...LEAVE_STATUSES], default: 'pending' },
    reason: { type: String, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const LeaveRequestModel = (models.LeaveRequest ??
  model('LeaveRequest', LeaveRequestSchema)) as Model<LeaveRequestDoc>;
