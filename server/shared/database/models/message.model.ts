import { Schema, model, models, type Model, type Types } from 'mongoose';
import { MESSAGE_THREADS, ROLES, type MessageThread, type Role } from '../enums';

export interface MessageDoc {
  moveId: string;
  thread: MessageThread;
  senderId: string;
  senderRole: Role;
  body: string;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

const MessageSchema = new Schema<MessageDoc>(
  {
    moveId: { type: String, required: true },
    thread: { type: String, enum: [...MESSAGE_THREADS], required: true },
    senderId: { type: String, required: true },
    senderRole: { type: String, enum: [...ROLES], required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

MessageSchema.index({ moveId: 1, thread: 1, createdAt: 1 });

export const MessageModel = (models.Message ??
  model('Message', MessageSchema)) as Model<MessageDoc>;
