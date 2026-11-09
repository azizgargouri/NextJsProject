import type { Metadata } from 'next';
import { MoverHome } from '@/components/features/mover/mover-home';

export const metadata: Metadata = { title: 'Dashboard' };

export default function Page() {
  return <MoverHome />;
}
