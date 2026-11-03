import type { Metadata } from 'next';
import { AdminModuleNotConnected } from '@/components/features/admin/admin-module-not-connected';

export const metadata: Metadata = { title: 'Pricing rules' };

export default function AdminPricingPage() {
  return (
    <AdminModuleNotConnected
      label="Pricing rules"
      description="Tune base fares, distance and volume multipliers, and service surcharges."
      planned={[
        'Rule table with effective dates and version history',
        'Distance and volume multiplier editor with validation',
        'Quote simulation against pending move requests',
      ]}
    />
  );
}
