import type { NotificationType } from '../../shared/database/enums';
import { moverRepository as repo } from './mover.repository';
import { serializeNotification } from './mover.serializer';
import type { NotificationsDto } from '../../../types/mover';

export async function notify(
  userId: string,
  notification: { type: NotificationType; title: string; body: string; link: string },
): Promise<void> {
  await repo.createNotification({ userId, ...notification });
}

export async function listNotifications(userId: string): Promise<NotificationsDto> {
  const [notifications, unreadCount] = await Promise.all([
    repo.listNotifications(userId, 50),
    repo.countUnreadNotifications(userId),
  ]);
  return { unreadCount, notifications: notifications.map(serializeNotification) };
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  await repo.markNotificationsRead(userId, ids, new Date());
}
