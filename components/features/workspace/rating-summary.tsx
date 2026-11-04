import type { RatingSummaryDto } from '@/types';
import { Stars } from './workspace-ui';

/** Server-renderable rating block (average, distribution bars, sub-scores). */
export function RatingSummary({ summary }: { summary: RatingSummaryDto }) {
  const max = Math.max(1, ...Object.values(summary.distribution));
  return (
    <div className="grid gap-px border border-ink bg-ink md:grid-cols-[260px_1fr_1fr]">
      <div className="bg-paper p-6">
        <p className="mono text-[10px] text-ink-80">AVERAGE</p>
        <p className="display mt-2 text-6xl">{summary.average ?? '—'}</p>
        {summary.average ? <Stars value={summary.average} size="lg" /> : null}
        <p className="mono mt-2 text-[10px] text-ink-40">{summary.count} PUBLISHED REVIEW(S)</p>
      </div>
      <div className="space-y-2 bg-paper p-6">
        {(['5', '4', '3', '2', '1'] as const).map((star) => (
          <div key={star} className="mono flex items-center gap-3 text-[10px]">
            <span className="w-3">{star}</span>
            <div className="h-2 flex-1 bg-paper-soft" aria-hidden>
              <div
                className="h-full bg-ink"
                style={{ width: `${(summary.distribution[star] / max) * 100}%` }}
              />
            </div>
            <span className="w-6 text-right">{summary.distribution[star]}</span>
          </div>
        ))}
      </div>
      <div className="mono space-y-3 bg-paper p-6 text-[11px]">
        {(
          [
            ['Punctuality', summary.punctuality],
            ['Care of items', summary.care],
            ['Communication', summary.communication],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-ink-80">{label}</span>
            <span>{value ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
