import type { Metadata } from 'next';
import { ProfilePortal } from '@/components/features/admin/account/profile-portal';

export const metadata: Metadata = { title: 'Profile' };

export default function AdminProfilePage() {
  return <ProfilePortal />;
}
