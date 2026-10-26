import { Schema, model, models, type Model, type Types } from 'mongoose';
import {
  EMPLOYEE_ROLES,
  EMPLOYEE_STATUSES,
  type EmployeeRole,
  type EmployeeStatus,
} from '../enums';

/**
 * Employee document — the RH directory record. Authentication stays with the
 * platform `User` account; `organization` points at the owning user so every
 * HR query can be scoped to one tenant.
 */
export interface EmployeeDoc {
  id: string;
  employeeRef: string;
  fullName: string;
  email: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  hireDate: Date | null;
  organization: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

const EmployeeSchema = new Schema<EmployeeDoc>(
  {
    employeeRef: { type: String, required: true, unique: true, trim: true, index: true },
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: { type: String, enum: [...EMPLOYEE_ROLES], default: 'employee' },
    status: { type: String, enum: [...EMPLOYEE_STATUSES], default: 'active' },
    hireDate: { type: Date, default: null },
    organization: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true },
);

export const EmployeeModel = (models.Employee ??
  model('Employee', EmployeeSchema)) as Model<EmployeeDoc>;
