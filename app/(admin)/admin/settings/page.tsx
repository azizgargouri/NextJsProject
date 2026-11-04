import type { Metadata } from 'next';
import { SettingsPortal } from '@/components/features/admin/account/settings-portal';

export const metadata: Metadata = { title: 'Account settings' };

export default function AdminSettingsPage() {
  return <SettingsPortal />;
}
