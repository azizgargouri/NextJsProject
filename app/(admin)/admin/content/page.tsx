import type { Metadata } from 'next';
import { AdminModuleNotConnected } from '@/components/features/admin/admin-module-not-connected';

export const metadata: Metadata = { title: 'Content' };

export default function AdminContentPage() {
  return (
    <AdminModuleNotConnected
      label="Content"
      description="Edit public landing content, service descriptions, and coverage zones."
      planned={[
        'Landing section copy editor with live preview',
        'Coverage zone and service list management',
        'Locale-aware content publishing workflow',
      ]}
    />
  );
}
