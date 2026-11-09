import type { Metadata } from 'next';
import { ProfilePortal } from '@/components/features/mover/profile-portal';

export const metadata: Metadata = { title: 'Profile' };

export default function Page() {
  return <ProfilePortal />;
}
