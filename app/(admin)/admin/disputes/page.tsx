import type { Metadata } from 'next';
import { DisputesPortal } from '@/components/features/admin/disputes/disputes-portal';

export const metadata: Metadata = { title: 'Disputes' };

export default function AdminDisputesPage() {
  return <DisputesPortal />;
}
