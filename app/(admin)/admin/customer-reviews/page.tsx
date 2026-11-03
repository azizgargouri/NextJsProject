import type { Metadata } from 'next';
import { ReviewsPortal } from '@/components/features/admin/reviews/reviews-portal';

export const metadata: Metadata = { title: 'Customer reviews' };

export default function AdminCustomerReviewsPage() {
  return <ReviewsPortal />;
}
