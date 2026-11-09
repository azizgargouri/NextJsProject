import type { Metadata } from 'next';
import { HomeCreatePortal } from '@/components/features/homes/home-create-portal';

export const metadata: Metadata = { title: 'Add a house' };

export default function NewHomePage() {
  return <HomeCreatePortal />;
}
