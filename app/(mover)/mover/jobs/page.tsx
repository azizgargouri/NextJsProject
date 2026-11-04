import type { Metadata } from 'next';
import { JobsPortal } from '@/components/features/mover/jobs-portal';

export const metadata: Metadata = { title: 'Jobs' };

export default function Page() {
  return <JobsPortal />;
}
