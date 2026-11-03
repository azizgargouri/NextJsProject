import type { Metadata } from 'next';
import { AdminModuleNotConnected } from '@/components/features/admin/admin-module-not-connected';

export const metadata: Metadata = { title: 'Mover reviews' };

export default function AdminMoverReviewsPage() {
  return (
    <AdminModuleNotConnected
      label="Mover reviews"
      description="Approve, reject, or suspend mover applications after document and profile review."
      planned={[
        'Verification queue with pending applications first',
        'Document and profile inspection sheet per mover',
        'Approve, reject, and suspend actions with audit trail',
      ]}
    />
  );
}
