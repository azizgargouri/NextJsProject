'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { SectionHeading } from '@/components/shared/section-heading';
import { fill, type LandingLocale, type LandingMessages } from '@/lib/i18n/landing';
import { estimateQuote } from '@/lib/pricing/estimate';
import { cn } from '@/lib/utils';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export interface EstimatorRule {
  name: string;
  version: number;
  currency: string;
  baseFare: number;
  perKm: number;
  perM3: number;
  expressSurcharge: number;
  minQuote: number;
  effectiveFrom: string;
}

const DISTANCE = { min: 1, max: 400, initial: 14 };
const VOLUME = { min: 1, max: 60, initial: 18 };

/**
 * Estimator — Desire → Action. Reads the live ACTIVE pricing rule and prints
 * the same arithmetic a quote starts from, as a ledger slip. No invented
 * numbers: with no live rule the section says so instead of guessing.
 */
export function Estimator({
  rule,
  t,
  locale,
}: {
  rule: EstimatorRule | null;
  t: LandingMessages['estimate'];
  locale: LandingLocale;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const [distanceKm, setDistanceKm] = useState(DISTANCE.initial);
  const [volumeM3, setVolumeM3] = useState(VOLUME.initial);
  const [express, setExpress] = useState(false);

  const tag = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const money = useMemo(
    () => new Intl.NumberFormat(tag, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
    [tag],
  );
  const effective = useMemo(
    () =>
      rule
        ? new Intl.DateTimeFormat(tag, { dateStyle: 'long', timeZone: 'UTC' })
            .format(new Date(rule.effectiveFrom))
            .toUpperCase()
        : '',
    [rule, tag],
  );

  const breakdown = rule ? estimateQuote(rule, { distanceKm, volumeM3, express }) : null;

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.from('[data-slip]', {
        yPercent: 18,
        rotate: -2.5,
        autoAlpha: 0,
        duration: 1.3,
        ease: 'expo.out',
        scrollTrigger: { trigger: '[data-slip]', start: 'top 85%', once: true },
      });
    },
    { scope: rootRef },
  );

  return (
    <section
      id="estimate"
      tabIndex={-1}
      ref={rootRef}
      aria-labelledby="estimate-title"
      className="scroll-mt-14 border-b border-ink bg-paper-soft outline-none"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-24 md:px-6 md:py-32">
        <SectionHeading id="estimate-title" index={t.index} title={t.title} className="mb-12" />

        {!rule || !breakdown ? (
          <div className="max-w-2xl border-2 border-ink bg-paper p-8">
            <p className="display text-2xl">{t.noRuleTitle}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-80">{t.noRuleBody}</p>
          </div>
        ) : (
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <p className="max-w-[44ch] text-base leading-relaxed text-ink-80">{t.intro}</p>

              <div className="mt-10 space-y-10">
                <RangeControl
                  label={t.distance}
                  hint={t.distanceHint}
                  unit={t.km}
                  value={distanceKm}
                  onChange={setDistanceKm}
                  {...DISTANCE}
                />
                <RangeControl
                  label={t.volume}
                  hint={t.volumeHint}
                  unit={t.m3}
                  value={volumeM3}
                  onChange={setVolumeM3}
                  {...VOLUME}
                />
                <ExpressSwitch
                  label={t.express}
                  hint={fill(t.expressHint, { pct: rule.expressSurcharge })}
                  checked={express}
                  onChange={setExpress}
                />
              </div>
            </div>

            <div className="lg:col-span-7">
              <div
                data-slip
                className="relative border-2 border-ink bg-paper shadow-[10px_10px_0_0_var(--color-ink)]"
              >
                <div className="flex items-start justify-between gap-4 border-b-2 border-dashed border-ink/40 px-6 py-5 md:px-8">
                  <div>
                    <p className="mono text-[11px] text-hazard-ink">{t.receipt}</p>
                    <p className="mono mt-1 text-xs font-bold">
                      {fill(t.ruleLine, { name: rule.name.toUpperCase(), version: rule.version })}
                    </p>
                  </div>
                  <p className="mono text-right text-[11px] text-ink-60">
                    {fill(t.effective, { date: effective })}
                  </p>
                </div>

                <dl className="mono space-y-3 px-6 py-6 text-xs md:px-8">
                  <LedgerLine label={t.base} value={money.format(breakdown.base)} />
                  <LedgerLine
                    label={fill(t.distanceLine, { km: distanceKm, rate: money.format(rule.perKm) })}
                    value={money.format(breakdown.distance)}
                  />
                  <LedgerLine
                    label={fill(t.volumeLine, { m3: volumeM3, rate: money.format(rule.perM3) })}
                    value={money.format(breakdown.volume)}
                  />
                  <div className="border-t border-ink/30 pt-3">
                    <LedgerLine
                      label={t.subtotal}
                      value={money.format(breakdown.subtotal)}
                      strong
                    />
                  </div>
                  <LedgerLine
                    label={fill(t.expressLine, { pct: rule.expressSurcharge })}
                    value={express ? `+${money.format(breakdown.express)}` : '—'}
                    muted={!express}
                  />
                  <p
                    aria-live="polite"
                    className={cn(
                      'text-[11px] text-hazard-ink transition-opacity duration-200',
                      breakdown.minimumApplied ? 'opacity-100' : 'opacity-0',
                    )}
                  >
                    {breakdown.minimumApplied
                      ? `* ${t.minimum} (${money.format(rule.minQuote)})`
                      : ' '}
                  </p>
                </dl>

                <div className="border-t-2 border-ink bg-ink px-6 py-6 text-paper md:px-8">
                  <p className="mono text-[11px] text-paper/70">{t.total}</p>
                  <p className="mt-2 flex items-baseline gap-3" aria-live="polite" aria-atomic>
                    <TotalFigure value={breakdown.total} format={(v) => money.format(v)} />
                    <span className="mono text-sm text-hazard-glow">{t.currency}</span>
                  </p>
                </div>

                <div className="flex flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-8">
                  <p className="max-w-[46ch] text-xs leading-relaxed text-ink-80">{t.disclaimer}</p>
                  <Link
                    href="/sign-up"
                    className="mono inline-flex h-12 shrink-0 items-center justify-center bg-hazard px-6 text-xs text-white transition-colors duration-200 hover:bg-ink"
                  >
                    {t.cta}
                  </Link>
                </div>

                {/* Perforated tear line */}
                <div
                  aria-hidden
                  className="absolute -bottom-[7px] left-0 right-0 h-3 bg-[radial-gradient(circle,var(--color-paper-soft)_4px,transparent_4.5px)] bg-[length:16px_12px] bg-repeat-x"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function RangeControl({
  label,
  hint,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  initial: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const fillPct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <label htmlFor={id} className="mono text-[11px] text-ink-80">
          {label}
        </label>
        <output htmlFor={id} className="display text-4xl tabular-nums md:text-5xl">
          {value}
          <span className="mono ml-2 align-baseline text-sm font-normal tracking-normal">
            {unit}
          </span>
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={`${value} ${unit}`}
        className="ledger-range mt-4"
        style={{ ['--fill' as string]: `${fillPct}%` }}
      />
      <div className="mono mt-2 flex justify-between text-[11px] text-ink-60">
        <span>{hint}</span>
        <span>
          {min}–{max} {unit}
        </span>
      </div>
    </div>
  );
}

function ExpressSwitch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-center justify-between gap-6 border-2 border-ink px-5 py-4 text-left transition-colors duration-200',
        checked ? 'bg-ink text-paper' : 'bg-paper hover:bg-ink/5',
      )}
    >
      <span>
        <span className="mono block text-xs font-bold">{label}</span>
        <span className={cn('mt-1 block text-xs', checked ? 'text-paper/75' : 'text-ink-80')}>
          {hint}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          'relative h-6 w-11 shrink-0 border-2 transition-colors duration-200',
          checked ? 'border-paper bg-hazard' : 'border-ink bg-paper',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-3.5 transition-transform duration-200 ease-out',
            checked ? 'translate-x-[22px] bg-paper' : 'translate-x-0.5 bg-ink',
          )}
        />
      </span>
    </button>
  );
}

function LedgerLine({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={cn('flex items-baseline gap-3', muted && 'text-ink-60', strong && 'font-bold')}>
      <dt className="shrink-0">{label}</dt>
      <span aria-hidden className="mb-1 flex-1 border-b border-dotted border-ink/40" />
      <dd className="shrink-0 tabular-nums">{value}</dd>
    </div>
  );
}

/** Rolls the printed total to its new value; instant under reduced motion. */
function TotalFigure({ value, format }: { value: number; format: (value: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = value;
      el.textContent = format(value);
      return;
    }
    const state = { v: current.current };
    const tween = gsap.to(state, {
      v: value,
      duration: 0.7,
      ease: 'expo.out',
      onUpdate: () => {
        current.current = state.v;
        el.textContent = format(state.v);
      },
    });
    return () => {
      tween.kill();
    };
  }, [format, value]);

  return (
    <span ref={ref} className="display text-[clamp(3rem,7vw,5.5rem)] tabular-nums">
      {format(value)}
    </span>
  );
}
