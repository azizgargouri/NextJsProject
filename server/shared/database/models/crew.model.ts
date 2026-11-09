import { Schema, model, models, type Model, type Types } from 'mongoose';
import { CREW_STATUSES, type CrewStatus } from '../enums';

/**
 * Crew document — an HR-defined team inside one organisation. Members point at
 * employee directory rows; `leader` is optional and must also be a member.
 */
export interface CrewDoc {
  name: string;
  code: string | null;
  organization: Types.ObjectId;
  leader: Types.ObjectId | null;
  members: Types.ObjectId[];
  status: CrewStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

const CrewSchema = new Schema<CrewDoc>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: null },
    organization: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    leader: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    members: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
      default: [],
    },
    status: { type: String, enum: [...CREW_STATUSES], default: 'active', index: true },
    notes: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

// One crew name per organisation, and fast "which crew is this employee in?" reads.
CrewSchema.index({ organization: 1, name: 1 }, { unique: true });
CrewSchema.index({ organization: 1, status: 1, members: 1 });
CrewSchema.index({ organization: 1, code: 1 });

export const CrewModel = (models.Crew ?? model('Crew', CrewSchema)) as Model<CrewDoc>;
