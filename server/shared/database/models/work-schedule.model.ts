import { Schema, model, models, type Model, type Types } from 'mongoose';
import { WORK_SCHEDULE_STATUSES, type WorkScheduleStatus } from '../enums';

/** Planned shift — feeds the dashboard's scheduled-vs-checked-in report. */
export interface WorkScheduleDoc {
  id: string;
  employee: Types.ObjectId;
  workDate: Date;
  shiftStart: Date;
  shiftEnd: Date;
  status: WorkScheduleStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

const WorkScheduleSchema = new Schema<WorkScheduleDoc>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    workDate: { type: Date, required: true },
    shiftStart: { type: Date, required: true },
    shiftEnd: { type: Date, required: true },
    status: { type: String, enum: [...WORK_SCHEDULE_STATUSES], default: 'planned' },
    notes: { type: String, default: null },
  },
  { timestamps: true },
);

export const WorkScheduleModel = (models.WorkSchedule ??
  model('WorkSchedule', WorkScheduleSchema)) as Model<WorkScheduleDoc>;
