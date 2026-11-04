import type { Metadata } from 'next';
import { DashboardLayout } from '@/components/features/dashboard/dashboard-shell';
import { HomesPortal } from '@/components/features/homes/homes-portal';

export const metadata: Metadata = { title: 'My new house' };

export default function HomesPage() {
  return (
    <DashboardLayout>
      <HomesPortal />
    </DashboardLayout>
  );
}
