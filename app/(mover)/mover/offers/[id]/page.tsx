import type { Metadata } from 'next';
import { OfferDetail } from '@/components/features/mover/offers-portal';

export const metadata: Metadata = { title: 'Offer' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OfferDetail id={id} />;
}
