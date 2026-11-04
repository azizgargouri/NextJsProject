import type { ReactNode } from 'react';
import { AdminShell } from '@/components/features/admin/admin-shell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
