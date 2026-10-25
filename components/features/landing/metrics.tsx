'use client';

import { Counter } from '@/components/shared/counter';

/**
 * Oversized metrics strip — Interest.
 * Registry-style numbers with organic digits (no fake 99.99% patterns).
 */
const METRICS = [
  {
    value: 4812,
    label: 'MOVES COMPLETED',
    format: (v: number) => Math.round(v).toLocaleString('en-US'),
    detail: 'SINCE 2024',
  },
  {
    value: 237,
    label: 'VETTED MOVERS',
    format: (v: number) => Math.round(v).toString(),
    detail: 'INSURANCE CHECKED',
  },
  {
    value: 4.7,
    label: 'AVERAGE RATING',
    format: (v: number) => v.toFixed(1),
    detail: 'PUBLISHED REVIEWS',
  },
  {
    value: 11,
    label: 'CITIES COVERED',
    format: (v: number) => Math.round(v).toString(),
    detail: 'TUNIS, SFAX, SOUSSE +8',
  },
];

export function Metrics() {
  return (
    <section className="border-b border-ink bg-paper">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-2 lg:grid-cols-4">
        {METRICS.map((metric, index) => (
          <div
            key={metric.label}
            className={`border-ink px-4 py-10 md:px-8 md:py-14 ${
              index % 2 === 0 ? 'border-r' : 'lg:border-r'
            } ${index < 2 ? 'border-b lg:border-b-0' : ''} ${index === 3 ? 'lg:border-r-0' : ''}`}
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
