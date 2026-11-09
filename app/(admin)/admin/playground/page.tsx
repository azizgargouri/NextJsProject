import type { Metadata } from 'next';
import { PlaygroundPortal } from '@/components/features/admin/playground/playground-portal';

export const metadata: Metadata = { title: 'Playground' };

export default function AdminPlaygroundPage() {
  return <PlaygroundPortal />;
}
