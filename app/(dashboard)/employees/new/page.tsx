import type { Metadata } from 'next';
import { DashboardLayout } from '@/components/features/dashboard/dashboard-shell';
import { AddEmployeeForm } from '@/components/features/hr/add-employee-form';

export const metadata: Metadata = {
  title: 'Add employee',
};

export default function NewEmployeePage() {
  return (
    <DashboardLayout adminOnly>
      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <AddEmployeeForm />
      </main>
    </DashboardLayout>
  );
}
