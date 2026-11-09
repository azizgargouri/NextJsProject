import type { Metadata } from 'next';
import { JobDetail } from '@/components/features/mover/jobs-portal';

export const metadata: Metadata = { title: 'Job' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobDetail id={id} />;
}
