import type { Metadata } from 'next';
import { NotificationsPortal } from '@/components/features/mover/notifications-portal';

export const metadata: Metadata = { title: 'Notifications' };

export default function Page() {
  return <NotificationsPortal />;
}
