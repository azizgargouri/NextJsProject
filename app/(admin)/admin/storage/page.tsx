import type { Metadata } from 'next';
import { StoragePortal } from '@/components/features/admin/storage/storage-portal';

export const metadata: Metadata = { title: 'Storage' };

export default function AdminStoragePage() {
  return <StoragePortal />;
}
