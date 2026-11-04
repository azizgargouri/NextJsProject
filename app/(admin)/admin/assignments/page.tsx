import type { Metadata } from 'next';
import { AssignmentsPortal } from '@/components/features/admin/assignments/assignments-portal';

export const metadata: Metadata = { title: 'Vehicle & mover assignments' };

export default function AdminAssignmentsPage() {
  return <AssignmentsPortal />;
}
