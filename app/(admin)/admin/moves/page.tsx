import type { Metadata } from 'next';
import { MovesPortal } from '@/components/features/admin/moves/moves-portal';

export const metadata: Metadata = { title: 'Move requests' };

export default function AdminMovesPage() {
  return <MovesPortal />;
}
