import type { Metadata } from 'next';
import { AdminModuleNotConnected } from '@/components/features/admin/admin-module-not-connected';

export const metadata: Metadata = { title: 'Move requests' };

export default function AdminMovesPage() {
  return <AdminModuleNotConnected module="moves" />;
}
