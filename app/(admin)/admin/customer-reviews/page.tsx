import type { Metadata } from 'next';
import { AdminModuleNotConnected } from '@/components/features/admin/admin-module-not-connected';

export const metadata: Metadata = { title: 'Customer reviews' };

export default function AdminCustomerReviewsPage() {
  return (
    <AdminModuleNotConnected
      label="Customer reviews"
      description="Moderate customer reviews left on completed moves and handle takedown requests."
      planned={[
        'Review feed per mover with rating distribution',
        'Hide or restore reviews with a stated reason',
        'Abuse detection counter returns to the moderation queue',
      ]}
    />
  );
}
