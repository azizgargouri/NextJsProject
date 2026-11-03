import type { Metadata } from 'next';
import { AdminModuleNotConnected } from '@/components/features/admin/admin-module-not-connected';

export const metadata: Metadata = { title: 'Assignments' };

export default function AdminAssignmentsPage() {
  return (
    <AdminModuleNotConnected
      label="Assignments"
      description="Dispatch movers to move requests and monitor crew coverage across the platform."
      planned={[
        'Unassigned move queue with crew availability',
        'Manual mover assignment with conflict detection',
        'Assignment timeline from dispatch to completion',
      ]}
    />
  );
}
