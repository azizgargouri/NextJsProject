import type { Metadata } from 'next';
import { DashboardContent } from './dashboard-content';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/** (dashboard) route group — protected shell hosting HR control surface for Admin, and Workspace for Client. */
export default function DashboardPage() {
  return <DashboardContent />;
}
