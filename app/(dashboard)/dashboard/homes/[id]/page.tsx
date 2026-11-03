import type { Metadata } from 'next';
import { DashboardLayout } from '@/components/features/dashboard/dashboard-shell';
import { HomeDetailPortal } from '@/components/features/homes/home-detail-portal';

export const metadata: Metadata = { title: 'House' };

export default async function HomeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DashboardLayout>
      <HomeDetailPortal homeId={id} />
    </DashboardLayout>
  );
}
