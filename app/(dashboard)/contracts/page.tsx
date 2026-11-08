import type { Metadata } from 'next';
import { DashboardLayout } from '@/components/features/dashboard/dashboard-shell';
import { ContractsView } from '@/components/features/contracts/contracts-view';

export const metadata: Metadata = {
  title: 'Contracts',
};

export default function ContractsPage() {
  return (
    <DashboardLayout>
      <ContractsView />
    </DashboardLayout>
  );
}
