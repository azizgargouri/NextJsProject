import type { Metadata } from 'next';
import { AdminModuleNotConnected } from '@/components/features/admin/admin-module-not-connected';

export const metadata: Metadata = { title: 'Mover reviews' };

export default function AdminMoverReviewsPage() {
  return <AdminModuleNotConnected module="moverReviews" />;
}
