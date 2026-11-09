'use client';

import { Counter } from '@/components/shared/counter';
import type { PublicMetrics } from '@/server/modules/mover/mover.public';

/**
 * Oversized metrics strip — Interest.
 * Live figures from the database. A figure with nothing behind it yet is left
 * out rather than invented, and the strip disappears when none are left.
 */
interface Metric {
  value: number;
  label: string;
  format: (value: number) => string;
  detail: string;
}

const whole = (value: number) => Math.round(value).toLocaleString('en-US');

function metricsFrom(data: PublicMetrics): Metric[] {
  const metrics: Metric[] = [];
  if (data.completedMoves > 0) {
    metrics.push({
      value: data.completedMoves,
      label: data.completedMoves === 1 ? 'MOVE COMPLETED' : 'MOVES COMPLETED',
      format: whole,
      detail: 'ON MOVEUP',
    });
  }
  if (data.approvedMovers > 0) {
    metrics.push({
      value: data.approvedMovers,
      label: data.approvedMovers === 1 ? 'VETTED MOVER' : 'VETTED MOVERS',
      format: whole,
      detail: 'APPROVED BY OUR TEAM',
    });
  }
  if (data.averageRating) {
    metrics.push({
      value: data.averageRating.value,
      label: 'AVERAGE RATING',
      format: (value) => value.toFixed(1),
      detail: `FROM ${whole(data.averageRating.reviews)} ${
        data.averageRating.reviews === 1 ? 'REVIEW' : 'REVIEWS'
      }`,
    });
  }
  if (data.zones.length > 0) {
    const named = data.zones.slice(0, 3).map((zone) => zone.toUpperCase());
    const rest = data.zones.length - named.length;
    metrics.push({
      value: data.zones.length,
      label: data.zones.length === 1 ? 'CITY COVERED' : 'CITIES COVERED',
      format: whole,
      detail: rest > 0 ? `${named.join(', ')} +${rest}` : named.join(', '),
    });
  }
  return metrics;
}

const COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
};

export function Metrics({ data }: { data: PublicMetrics | null }) {
  const metrics = data ? metricsFrom(data) : [];
  if (metrics.length === 0) return null;
  const last = metrics.length - 1;

  return (
    <section className="border-b border-ink bg-paper">
      <div className={`mx-auto grid w-full max-w-7xl ${COLUMNS[metrics.length]}`}>
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={`border-ink px-4 py-10 md:px-8 md:py-14 ${
              index === last ? '' : index % 2 === 0 ? 'border-r' : 'lg:border-r'
            } ${metrics.length > 2 && index < 2 ? 'border-b lg:border-b-0' : ''}`}
          >
            <p className="display text-5xl md:text-6xl text-ink">
              <Counter value={metric.value} format={metric.format} />
            </p>
            <p className="mono mt-3 text-[10px] text-hazard">{metric.label}</p>
            <p className="mono mt-1 text-[10px] text-ink-40">{metric.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
