import type { Metadata } from 'next';
import { AuditPortal } from '@/components/features/admin/audit/audit-portal';

export const metadata: Metadata = { title: 'Audit log' };

export default function AdminAuditPage() {
  return <AuditPortal />;
}
