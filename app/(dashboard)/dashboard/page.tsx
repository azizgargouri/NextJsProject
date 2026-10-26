import type { Metadata } from 'next';
import { DashboardLayout } from '@/components/features/dashboard/dashboard-shell';
import { DashboardView } from '@/components/features/hr/dashboard-view';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/** (dashboard) route group — protected shell hosting the RH control surface. */
export default function DashboardPage() {
  return (
    <DashboardLayout adminOnly>
      <DashboardView />
    </DashboardLayout>
  );
}
