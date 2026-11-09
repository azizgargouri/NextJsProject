import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface TeamMemberDoc {
  moverId: string;
  name: string;
  phone: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

const TeamMemberSchema = new Schema<TeamMemberDoc>(
  {
    moverId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    role: { type: String, default: '', trim: true },
  },
  { timestamps: true },
);

export const TeamMemberModel = (models.TeamMember ??
  model('TeamMember', TeamMemberSchema)) as Model<TeamMemberDoc>;
