import type { Metadata } from 'next';
import { AdminModuleNotConnected } from '@/components/features/admin/admin-module-not-connected';

export const metadata: Metadata = { title: 'Disputes' };

export default function AdminDisputesPage() {
  return (
    <AdminModuleNotConnected
      label="Disputes"
      description="Review opened disputes, gather the move record, and issue a resolution."
      planned={[
        'Dispute inbox by state: open, under review, resolved',
        'Full move-record evidence panel per dispute',
        'Resolution recording with both parties notified',
      ]}
    />
  );
}
