import type { Metadata } from 'next';
import { ContentPortal } from '@/components/features/admin/content/content-portal';

export const metadata: Metadata = { title: 'Content' };

export default function AdminContentPage() {
  return <ContentPortal />;
}
