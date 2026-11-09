import { Schema, model, models, type Model, type Types } from 'mongoose';
import { NOTIFICATION_TYPES, type NotificationType } from '../enums';

/** In-app notification feed entry. */
export interface NotificationDoc {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** In-app path opened from the notification. */
  link: string;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
}

const NotificationSchema = new Schema<NotificationDoc>(
  {
    userId: { type: String, required: true },
    type: { type: String, enum: [...NOTIFICATION_TYPES], required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: '' },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, createdAt: -1 });

export const NotificationModel = (models.Notification ??
  model('Notification', NotificationSchema)) as Model<NotificationDoc>;
