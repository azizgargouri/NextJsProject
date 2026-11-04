import type { Metadata } from 'next';
import { AdminModuleNotConnected } from '@/components/features/admin/admin-module-not-connected';

export const metadata: Metadata = { title: 'Disputes' };

export default function AdminDisputesPage() {
  return <AdminModuleNotConnected module="disputes" />;
}
