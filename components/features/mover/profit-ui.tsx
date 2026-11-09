'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProfitabilityDto, ProfitLineKind, ProfitVerdict } from '@/types';
import { formatDuration, formatMoney } from './format';

/**
 * The profitability estimate on offers: a strip on each card and the full
 * "Is it worth it?" panel. Swiss print rules apply: ink, paper and hazard red
 * only, hard edges, no shadows. Motion is limited to numbers and bars filling
 * in, and is skipped under prefers-reduced-motion.
 */

interface Look {
  title: string;
  band: string;
  muted: string;
  meterTrack: string;
  meterFill: string;
  meterTick: string;
}

const LOOKS: Record<ProfitVerdict | 'QUOTE', Look> = {
  GOOD: {
    title: 'Worth taking',
    band: 'bg-ink text-paper',
    muted: 'text-paper/70',
    meterTrack: 'bg-paper/25',
    meterFill: 'bg-paper',
    meterTick: 'bg-hazard',
  },
  OK: {
    title: 'Worth a look',
    band: 'bg-paper-soft text-ink border-t border-ink',
    muted: 'text-ink-80',
    meterTrack: 'bg-ink/15',
    meterFill: 'bg-ink',
    meterTick: 'bg-hazard',
  },
  LOW: {
    title: 'Low pay',
    band: 'bg-hazard text-paper',
    muted: 'text-paper/85',
    meterTrack: 'bg-paper/30',
    meterFill: 'bg-paper',
    meterTick: 'bg-ink',
  },
  QUOTE: {
    title: 'Suggested quote',
    band: 'bg-paper-soft text-ink border-t border-ink',
    muted: 'text-ink-80',
    meterTrack: 'bg-ink/15',
    meterFill: 'bg-ink',
    meterTick: 'bg-hazard',
  },
};

const SEGMENTS: Record<Exclude<ProfitLineKind, 'PRICE'> | 'KEEP', { fill: string; name: string }> =
  {
    COMMISSION: { fill: 'bg-ink-40', name: 'Commission' },
    FUEL: { fill: 'bg-ink-80', name: 'Fuel' },
    HELPERS: { fill: 'bg-ink', name: 'Helpers' },
    WEAR: { fill: 'hatch bg-paper', name: 'Wear' },
    KEEP: { fill: 'bg-hazard', name: 'You keep' },
  };

const whole = (value: number, currency: string) => formatMoney(Math.round(value), currency);

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** True one frame after mounting, so bar widths animate from zero. */
function useEntered(): boolean {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return entered;
}

/** Counts up to the value, and again whenever it changes. */
function Rolling({ value, format }: { value: number; format: (value: number) => string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reducedMotion()) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 900);
      setShown(value * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className="tabular-nums">{format(shown)}</span>;
}

const GROW = 'motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out';

/** Hourly net against the mover's own target, with the target as a tick. */
function PayMeter({
  perHour,
  target,
  look,
  tall = false,
}: {
  perHour: number;
  target: number;
  look: Look;
  tall?: boolean;
}) {
  const entered = useEntered();
  const max = Math.max(target * 1.6, perHour * 1.15, 1);
  const filled = Math.min(100, Math.max(0, (perHour / max) * 100));
  const tick = Math.min(100, (target / max) * 100);
  return (
    <div
      role="meter"
      aria-label="Pay per hour compared with your target"
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.max(0, Math.round(perHour))}
      className={cn('relative', tall ? 'h-3' : 'h-1.5', look.meterTrack)}
    >
      <div
        className={cn('h-full', look.meterFill, GROW)}
        style={{ width: `${entered ? filled : 0}%` }}
      />
      <span
        aria-hidden
        className={cn('absolute -bottom-1 -top-1 w-0.5', look.meterTick)}
        style={{ left: `calc(${tick}% - 1px)` }}
      />
    </div>
  );
}

/** One line on an offer card: what the job pays per hour, or the price to ask. */
export function ProfitStrip({ profitability }: { profitability: ProfitabilityDto }) {
  const { verdict, net, netPerHour, suggestedQuote, currency, targetHourlyNet } = profitability;

  if (verdict && net !== null && netPerHour !== null) {
    const look = LOOKS[verdict];
    return (
      <div className={cn('-mx-4 -mb-4 mt-4 px-4 pb-4 pt-3', look.band)}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="mono text-[10px] font-bold">{look.title}</p>
            <p className={cn('mt-1 text-xs', look.muted)}>You keep about {whole(net, currency)}</p>
          </div>
          <p className="display text-3xl normal-case">
            {Math.round(netPerHour)}
            <span className="mono ml-1 text-[10px] font-bold">{currency}/h</span>
          </p>
        </div>
        <div className="mt-3">
          <PayMeter perHour={netPerHour} target={targetHourlyNet} look={look} />
        </div>
      </div>
    );
  }

  if (suggestedQuote) {
    const look = LOOKS.QUOTE;
    return (
      <div className={cn('-mx-4 -mb-4 mt-4 px-4 pb-4 pt-3', look.band)}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="mono text-[10px] font-bold">{look.title}</p>
            <p className={cn('mt-1 text-xs', look.muted)}>
              You would keep about {whole(suggestedQuote.net, currency)}
            </p>
          </div>
          <p className="display text-3xl normal-case">
            {suggestedQuote.amount}
            <span className="mono ml-1 text-[10px] font-bold">{currency}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
}

function Figure({
  label,
  children,
  alert,
}: {
  label: string;
  children: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className="px-3 py-4 sm:px-4">
      <p className="mono text-[10px] text-ink-80">{label}</p>
      <p
        className={cn(
          'display mt-2 whitespace-nowrap text-lg normal-case sm:text-2xl',
          alert && 'text-hazard-dark',
        )}
      >
        {children}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-ink px-4 py-4">
      <h3 className="mono mb-3 text-[10px] font-bold">{title}</h3>
      {children}
    </div>
  );
}

/** The price split into costs and what the mover keeps. */
function MoneyBar({ profitability, keep }: { profitability: ProfitabilityDto; keep: number }) {
  const entered = useEntered();
  const { breakdown, currency } = profitability;
  const price = breakdown.find((line) => line.kind === 'PRICE')?.amount ?? 0;
  const costs = breakdown
    .filter((line) => line.kind !== 'PRICE')
    .map((line) => ({
      key: line.kind as Exclude<ProfitLineKind, 'PRICE'>,
      label: line.label,
      value: -line.amount,
    }));
  const parts =
    keep > 0 ? [...costs, { key: 'KEEP' as const, label: 'You keep', value: keep }] : costs;
  const totalCosts = costs.reduce((total, part) => total + part.value, 0);
  const scale = Math.max(price, totalCosts, 1);

  return (
    <>
      <div className="relative">
        <div className="flex h-8 overflow-hidden border border-ink bg-paper">
          {parts.map((part) => (
            <div
              key={part.key}
              title={`${part.label}: ${whole(part.value, currency)}`}
              className={cn('h-full shrink-0', SEGMENTS[part.key].fill, GROW)}
              style={{ width: `${entered ? (part.value / scale) * 100 : 0}%` }}
            />
          ))}
        </div>
        {totalCosts > price ? (
          <span
            aria-hidden
            className="absolute -bottom-2 -top-2 w-0.5 bg-hazard"
            style={{ left: `${(price / scale) * 100}%` }}
          />
        ) : null}
      </div>
      {totalCosts > price ? (
        <p className="mt-3 text-sm font-bold text-hazard-dark">
          Costs pass the price (red line) by {whole(totalCosts - price, currency)}.
        </p>
      ) : null}

      <ul className="mt-4 grid gap-y-2 text-sm">
        <li className="flex items-baseline justify-between gap-3 border-b border-ink/20 pb-2">
          <span className="font-bold">{breakdown[0]?.label}</span>
          <span className="font-bold tabular-nums">{whole(price, currency)}</span>
        </li>
        {parts.map((part) => (
          <li key={part.key} className="flex items-baseline gap-3">
            <span
              aria-hidden
              className={cn(
                'size-3 shrink-0 translate-y-0.5 border border-ink',
                SEGMENTS[part.key].fill,
              )}
            />
            <span className={cn('flex-1', part.key === 'KEEP' ? 'font-bold' : 'text-ink-80')}>
              {part.label}
            </span>
            <span className="mono text-[10px] text-ink-40">
              {price > 0 ? `${Math.round((part.value / price) * 100)}%` : ''}
            </span>
            <span
              className={cn(
                'w-24 text-right tabular-nums',
                part.key === 'KEEP' && 'font-bold text-hazard-dark',
              )}
            >
              {part.key === 'KEEP' ? '' : '−'}
              {whole(part.value, currency)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Likely time, with the stretch up to the worst case hatched. */
function TimeBar({ profitability }: { profitability: ProfitabilityDto }) {
  const entered = useEntered();
  const { hours, netWorstCase, currency, distanceKm } = profitability;
  const likely = hours.worst > 0 ? (hours.likely / hours.worst) * 100 : 100;
  return (
    <>
      <div className="flex h-4 border border-ink">
        <div
          className={cn('h-full shrink-0 bg-ink', GROW)}
          style={{ width: `${entered ? likely : 0}%` }}
        />
        <div className="hatch h-full flex-1" />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-sm">
        <span>
          About <span className="font-bold">{formatDuration(hours.likely)}</span>
        </span>
        <span className="text-ink-80">Up to {formatDuration(hours.worst)}</span>
      </div>
      <p className="mt-3 text-sm text-ink-80">
        {distanceKm} km in all, the drive back to your base included.
        {netWorstCase !== null ? (
          <>
            {' '}
            If it runs long, you keep{' '}
            <span className={cn('font-bold', netWorstCase < 0 ? 'text-hazard-dark' : 'text-ink')}>
              {whole(netWorstCase, currency)}
            </span>
            .
          </>
        ) : null}
      </p>
    </>
  );
}

/** Where the suggested price sits among what similar finished jobs were paid. */
function SimilarRange({
  amount,
  range,
  currency,
}: {
  amount: number;
  range: { low: number; high: number };
  currency: string;
}) {
  const min = Math.min(range.low, amount) * 0.8;
  const max = Math.max(range.high, amount) * 1.2;
  const at = (value: number) => ((value - min) / (max - min)) * 100;
  return (
    <>
      <div className="relative h-3 bg-ink/10">
        <div
          className="absolute inset-y-0 bg-ink-40"
          style={{ left: `${at(range.low)}%`, width: `${at(range.high) - at(range.low)}%` }}
        />
        <span
          aria-hidden
          className="absolute -bottom-1.5 -top-1.5 w-0.5 bg-hazard"
          style={{ left: `${at(amount)}%` }}
        />
      </div>
      <p className="mt-3 text-sm">
        Similar jobs were paid {whole(range.low, currency)} to {whole(range.high, currency)}. The
        red mark is the suggested price.
      </p>
    </>
  );
}

function headline(profitability: ProfitabilityDto, keep: number): string {
  const target = whole(profitability.targetHourlyNet, profitability.currency);
  if (profitability.price === null) {
    return `Covers a long day and your ${target} an hour target. Change it as you see fit.`;
  }
  if (profitability.verdict === 'GOOD') return `Pays above your ${target} an hour target.`;
  if (keep < 0) return 'This job costs you more than it pays.';
  if (profitability.verdict === 'OK')
    return `Covers your costs, but below your ${target} an hour target.`;
  return `Well below your ${target} an hour target.`;
}

/** The full estimate on an offer: an aid for the decision, never a promise. */
export function ProfitPanel({ profitability }: { profitability: ProfitabilityDto }) {
  const quote = profitability.price === null ? profitability.suggestedQuote : null;
  const look = profitability.verdict ? LOOKS[profitability.verdict] : LOOKS.QUOTE;
  const keep = profitability.net ?? quote?.net ?? 0;
  const perHour = profitability.netPerHour ?? quote?.netPerHour ?? 0;
  const { currency } = profitability;

  return (
    <section aria-labelledby="profit-title" className="border border-ink bg-paper">
      <header className={cn('px-4 pb-5 pt-4', look.band, 'border-t-0')}>
        <p className={cn('mono text-[10px]', look.muted)}>Is it worth it?</p>
        <h2 id="profit-title" className="display mt-3 text-4xl">
          {quote ? (
            <>
              <span className="block text-base">{look.title}</span>
              <span className="normal-case">
                <Rolling value={quote.amount} format={(value) => whole(value, currency)} />
              </span>
            </>
          ) : (
            look.title
          )}
        </h2>
        <p className={cn('mt-3 text-sm', look.muted)}>{headline(profitability, keep)}</p>
      </header>

      <div className="grid grid-cols-3 divide-x divide-ink border-t border-ink">
        <Figure label={quote ? 'You would keep' : 'You keep'} alert={keep < 0}>
          <Rolling value={keep} format={(value) => whole(value, currency)} />
        </Figure>
        <Figure label="Per hour" alert={perHour < 0}>
          <Rolling value={perHour} format={(value) => whole(value, currency)} />
        </Figure>
        <Figure label="Time away">{formatDuration(profitability.hours.likely)}</Figure>
      </div>

      <Section title="Per hour against your target">
        <PayMeter
          perHour={perHour}
          target={profitability.targetHourlyNet}
          look={{
            ...LOOKS.OK,
            meterFill: keep < 0 || profitability.verdict === 'LOW' ? 'bg-hazard' : 'bg-ink',
          }}
          tall
        />
        <div className="mt-2 flex justify-between text-xs text-ink-80">
          <span>{whole(perHour, currency)} an hour</span>
          <span>
            <span aria-hidden className="mr-1 inline-block h-2.5 w-0.5 bg-hazard align-middle" />
            Your target {whole(profitability.targetHourlyNet, currency)}
          </span>
        </div>
      </Section>

      <Section title="Where the money goes">
        <MoneyBar profitability={profitability} keep={keep} />
      </Section>

      <Section title="Time on the job">
        <TimeBar profitability={profitability} />
      </Section>

      {quote?.similarRange ? (
        <Section title="What similar jobs paid">
          <SimilarRange amount={quote.amount} range={quote.similarRange} currency={currency} />
        </Section>
      ) : null}

      {profitability.reasons.length > 0 ? (
        <Section title="Why">
          <ol className="flex flex-col gap-2 text-sm">
            {profitability.reasons.map((reason, index) => (
              <li key={reason} className="flex gap-3">
                <span className="mono pt-0.5 text-[10px] text-hazard-dark">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {profitability.warnings.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-ink px-4 py-4">
          {profitability.warnings.map((warning) => (
            <p key={warning} className="flex gap-2 text-sm font-bold">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-hazard-dark" aria-hidden />
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-ink bg-paper-soft px-4 py-3 text-xs">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'mono border px-2 py-1 text-[10px] leading-none',
              profitability.confidence === 'GOOD'
                ? 'border-ink bg-ink text-paper'
                : 'border-ink text-ink',
            )}
          >
            {profitability.confidence === 'GOOD'
              ? `Learned from ${profitability.basedOnJobs} jobs`
              : 'Rough estimate'}
          </span>
          <span className="text-ink-80">
            {profitability.confidence === 'GOOD'
              ? 'Based on finished jobs, yours included.'
              : profitability.basedOnJobs > 0
                ? 'Few of your own jobs to learn from yet.'
                : 'Not enough finished jobs to learn from yet.'}
            {profitability.costsAreDefaults ? ' Uses default costs.' : ''}
          </span>
        </span>
        <Link href="/mover/profile#costs" className="font-bold underline underline-offset-2">
          {profitability.costsAreDefaults ? 'Enter your costs' : 'Edit my costs'}
        </Link>
      </footer>
    </section>
  );
}
