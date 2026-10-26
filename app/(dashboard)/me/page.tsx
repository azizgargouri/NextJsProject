import type { Metadata } from 'next';
import { DashboardLayout } from '@/components/features/dashboard/dashboard-shell';
import { MyWorkspaceView } from '@/components/features/hr/my-workspace-view';

export const metadata: Metadata = {
  title: 'My workspace',
};

export default function MyWorkspacePage() {
  return (
    <DashboardLayout>
      <MyWorkspaceView />
    </DashboardLayout>
  );
}
