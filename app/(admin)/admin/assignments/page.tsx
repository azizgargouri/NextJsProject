import type { Metadata } from 'next';
import { AdminModuleNotConnected } from '@/components/features/admin/admin-module-not-connected';

export const metadata: Metadata = { title: 'Assignments' };

export default function AdminAssignmentsPage() {
  return <AdminModuleNotConnected module="assignments" />;
}
