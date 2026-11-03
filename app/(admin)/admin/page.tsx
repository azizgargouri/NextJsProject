import type { Metadata } from 'next';
import { AdminOverviewPortal } from '@/components/features/admin/overview/admin-overview-portal';

export const metadata: Metadata = { title: 'Admin overview' };

export default function AdminOverviewPage() {
  return <AdminOverviewPortal />;
}
