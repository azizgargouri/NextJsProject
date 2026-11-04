import type { Metadata } from 'next';
import { AdminModuleNotConnected } from '@/components/features/admin/admin-module-not-connected';

export const metadata: Metadata = { title: 'Move requests' };

export default function AdminMovesPage() {
  return (
    <AdminModuleNotConnected
      label="Move requests"
      description="Inspect, track, and adjudicate every customer move request from quote to completion."
      planned={[
        'Searchable move-request registry with status and date filters',
        'Move detail view with address, pricing, and assignment history',
        'Status transitions and cancellation handling with confirmation',
      ]}
    />
  );
}
