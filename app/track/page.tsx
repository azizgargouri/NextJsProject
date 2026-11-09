import type { Metadata } from 'next';
import { MoveTracking } from '@/components/features/moves/move-tracking';

export const metadata: Metadata = {
  title: 'Track Move',
};

export default function TrackMovePage() {
  return <MoveTracking />;
}
