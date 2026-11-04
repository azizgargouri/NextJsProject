'use client';

import Link from 'next/link';
import { DashboardLayout } from '@/components/features/dashboard/dashboard-shell';
import { DashboardView } from '@/components/features/hr/dashboard-view';
import { HomesDashboardEntry } from '@/components/features/homes/homes-dashboard-entry';
import { useAuthStore } from '@/hooks/stores/auth-store';

export function DashboardContent() {
  const role = useAuthStore((s) => s.user?.role);

  return (
    <DashboardLayout>
      {role === 'ADMIN' ? (
        <DashboardView />
      ) : (
        <main className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <h1 className="display text-4xl md:text-6xl">WORKSPACE.</h1>
          <p className="mono mt-4 text-[11px] text-ink-80">
            MANAGE YOUR MOVES, QUOTES &amp; SMART ROOM LAYOUTS.
          </p>
          <div className="mono mt-12 grid grid-cols-1 gap-px border border-ink bg-ink md:grid-cols-3">
            <Link href="/request" className="bg-paper p-8 block hover:bg-ink-10 transition">
              <p className="display text-2xl">REQUEST A MOVE</p>
              <p className="mono mt-2 text-[10px] text-hazard">STATUS: LIVE · 3D SCANNER &amp; LOAD</p>
            </Link>
            <Link href="/dashboard/homes" className="bg-paper p-8 block hover:bg-ink-10 transition">
              <p className="display text-2xl">SMART ROOM LAYOUT</p>
              <p className="mono mt-2 text-[10px] text-hazard">STATUS: LIVE · ROOM PLANNER</p>
            </Link>
            <div className="bg-paper p-8">
              <p className="display text-2xl">MY MOVES &amp; QUOTES</p>
              <p className="mono mt-2 text-[10px] text-ink-40">TRACKING &amp; DISPUTES</p>
            </div>
          </div>
          <HomesDashboardEntry />
        </main>
      )}
    </DashboardLayout>
  );
}
