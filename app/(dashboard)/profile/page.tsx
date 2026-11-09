import type { Metadata } from 'next';
import { DashboardLayout } from '@/components/features/dashboard/dashboard-shell';
import { ProfileView } from '@/components/features/profile/profile-view';

export const metadata: Metadata = {
  title: 'Profile',
};

export default function ProfilePage() {
  return (
    <DashboardLayout>
      <ProfileView />
    </DashboardLayout>
  );
}
