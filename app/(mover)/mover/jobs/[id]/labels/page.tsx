import type { Metadata } from 'next';
import { BoxLabelSheet } from '@/components/features/mover/box-labels';

export const metadata: Metadata = { title: 'Box labels' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BoxLabelSheet id={id} />;
}
