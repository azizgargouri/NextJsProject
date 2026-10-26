import type { Metadata } from 'next';
import { DashboardLayout } from '@/components/features/dashboard/dashboard-shell';
import { EmployeesView } from '@/components/features/hr/employees-view';

export const metadata: Metadata = {
  title: 'Employees',
};

export default function EmployeesPage() {
  return (
    <DashboardLayout adminOnly>
      <EmployeesView />
    </DashboardLayout>
  );
}
