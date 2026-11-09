import type { Metadata } from 'next';
import { HomeDetailPortal } from '@/components/features/homes/home-detail-portal';

export const metadata: Metadata = { title: 'House' };

export default async function HomeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HomeDetailPortal homeId={id} />;
}
