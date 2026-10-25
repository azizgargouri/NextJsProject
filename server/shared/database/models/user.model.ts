import { Schema, model, models, type Model, type Types } from 'mongoose';
import { ROLES, USER_STATUSES, type Role, type UserStatus } from '../enums';

/**
 * User document — accounts for clients, movers and admins.
 * Soft delete via deletedAt; hard delete is reserved for admin tooling.
 */
export interface UserDoc {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  phone: string;
  role: Role;
  locale: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  _id: Types.ObjectId;
}

/** String-id surface so rows look the same across the whole repository layer. */
const UserSchema = new Schema<UserDoc>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    role: { type: String, enum: [...ROLES], default: 'CLIENT' },
    locale: { type: String, enum: ['en', 'fr', 'ar'], default: 'en' },
    status: { type: String, enum: [...USER_STATUSES], default: 'ACTIVE' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const UserModel = (models.User ?? model('User', UserSchema)) as Model<UserDoc>;
