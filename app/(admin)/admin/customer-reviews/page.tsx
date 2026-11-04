import type { Metadata } from 'next';
import { AdminModuleNotConnected } from '@/components/features/admin/admin-module-not-connected';

export const metadata: Metadata = { title: 'Customer reviews' };

export default function AdminCustomerReviewsPage() {
  return <AdminModuleNotConnected module="customerReviews" />;
}
