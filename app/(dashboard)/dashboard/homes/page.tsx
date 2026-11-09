import type { Metadata } from 'next';
import { HomesPortal } from '@/components/features/homes/homes-portal';

export const metadata: Metadata = { title: 'My new house' };

export default function HomesPage() {
  return <HomesPortal />;
}
