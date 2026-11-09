import type { Metadata } from 'next';
import { NotificationsPortal } from '@/components/features/admin/account/notifications-portal';

export const metadata: Metadata = { title: 'Notifications' };

export default function AdminNotificationsPage() {
  return <NotificationsPortal />;
}
