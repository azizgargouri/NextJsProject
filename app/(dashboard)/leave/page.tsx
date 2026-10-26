import type { Metadata } from 'next';
import { DashboardLayout } from '@/components/features/dashboard/dashboard-shell';
import { LeaveView } from '@/components/features/hr/leave-view';

export const metadata: Metadata = {
  title: 'Leave',
};

export default function LeavePage() {
  return (
    <DashboardLayout adminOnly>
      <LeaveView />
    </DashboardLayout>
  );
}
