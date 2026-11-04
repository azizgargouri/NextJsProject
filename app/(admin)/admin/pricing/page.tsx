import type { Metadata } from 'next';
import { PricingPortal } from '@/components/features/admin/pricing/pricing-portal';

export const metadata: Metadata = { title: 'Pricing rules' };

export default function AdminPricingPage() {
  return <PricingPortal />;
}
