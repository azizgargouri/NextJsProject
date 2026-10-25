import type { Metadata } from 'next';
import { DashboardLayout } from '@/components/features/dashboard/dashboard-shell';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/** (dashboard) route group — protected shell. Proceeds: move requests, quotes, tracking. */
export default function DashboardPage() {
  return (
    <DashboardLayout>
      <main className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <h1 className="display text-4xl md:text-6xl">WORKSPACE.</h1>
        <p className="mono mt-4 text-[11px] text-ink-80">
          MODULE PENDING — MOVE REQUESTS / QUOTES / TRACKING (SPEC CH.3 C-02 → C-14).
        </p>
        <div className="mono mt-12 grid grid-cols-1 gap-px border border-ink bg-ink md:grid-cols-3">
          {['REQUEST A MOVE', 'MY QUOTES', 'MOVE HISTORY'].map((cell) => (
            <div key={cell} className="bg-paper p-8">
              <p className="display text-2xl">{cell}</p>
              <p className="mono mt-2 text-[10px] text-ink-40">STATUS: QUEUED</p>
            </div>
          ))}
        </div>
      </main>
    </DashboardLayout>
  );
}
