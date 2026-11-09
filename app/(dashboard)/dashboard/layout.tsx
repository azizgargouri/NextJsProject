import type { ReactNode } from 'react';
import { DashboardLayout } from '@/components/features/dashboard/dashboard-shell';
import { WorkspaceProvider } from '@/components/features/workspace/workspace-context';
import { WorkspaceNav } from '@/components/features/workspace/workspace-nav';

/**
 * App Shell of the client / mover workspace (course ch.2): header + navigation stay mounted
 * and cached by the service worker; only {children} (the dynamic content zone) changes.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardLayout>
      <WorkspaceProvider>
        <WorkspaceNav />
        <main className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">{children}</main>
      </WorkspaceProvider>
    </DashboardLayout>
  );
}
