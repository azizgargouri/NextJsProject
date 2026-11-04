import type { Metadata } from 'next';
import { OffersPortal } from '@/components/features/mover/offers-portal';

export const metadata: Metadata = { title: 'Offers' };

export default function Page() {
  return <OffersPortal />;
}
