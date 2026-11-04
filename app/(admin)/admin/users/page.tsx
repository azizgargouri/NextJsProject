import type { Metadata } from 'next';
import { UsersPortal } from '@/components/features/admin/users/users-portal';

export const metadata: Metadata = { title: 'User accounts' };

export default function AdminUsersPage() {
  return <UsersPortal />;
}
