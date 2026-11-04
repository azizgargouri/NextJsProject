import type { Metadata } from 'next';
import { EarningsPortal } from '@/components/features/mover/earnings-portal';

export const metadata: Metadata = { title: 'Earnings' };

export default function Page() {
  return <EarningsPortal />;
}
