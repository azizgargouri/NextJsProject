import type { Metadata } from 'next';
import { DashboardLayout } from '@/components/features/dashboard/dashboard-shell';
import { AttendanceView } from '@/components/features/hr/attendance-view';

export const metadata: Metadata = {
  title: 'Attendance',
};

export default function AttendancePage() {
  return (
    <DashboardLayout adminOnly>
      <AttendanceView />
    </DashboardLayout>
  );
}
