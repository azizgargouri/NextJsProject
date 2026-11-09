import type { Metadata } from 'next';
import { AvailabilityPortal } from '@/components/features/mover/availability-portal';

export const metadata: Metadata = { title: 'Availability' };

export default function Page() {
  return <AvailabilityPortal />;
}
