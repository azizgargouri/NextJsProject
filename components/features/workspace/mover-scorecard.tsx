'use client';

import { experimental_useObject as useObject } from '@ai-sdk/react';
import { ShieldCheck, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { MoverScorecardSchema } from '@/lib/quality/ai-schemas';

const TIER_LABELS: Record<string, string> = {
  ELITE_VERIFIED: 'ELITE VERIFIED PARTNER',
  TRUSTED_PRO: 'TRUSTED PRO MOVER',
  STANDARD_PARTNER: 'VERIFIED PARTNER',
  UNDER_WATCH: 'UNDER QUALITY WATCH',
};

/**
 * Public AI Trust & Reliability Scorecard on `/movers/[id]`.
 * Demonstrates `useObject` + `streamObject` (Course Chapter 6) on the public storefront.
 */
export function MoverScorecardCard({ moverId, moverName }: { moverId: string; moverName: string }) {
  const { object, submit, isLoading, error } = useObject({
    api: `/api/ai/movers/${moverId}/scorecard`,
    schema: MoverScorecardSchema,
  });

  const bars = [
    { label: 'Punctuality', value: object?.punctualityScore },
    { label: 'Item Care & Protection', value: object?.itemCareScore },
    { label: 'Client Communication', value: object?.communicationScore },
    { label: 'Dispute & Claim Track Record', value: object?.claimResolutionScore },
  ];

  return (
    <section className="border-2 border-ink bg-ink/[0.02] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mono flex items-center gap-1.5 text-[11px] font-bold text-hazard">
            <ShieldCheck className="size-4" /> AI MOVER TRUST & RELIABILITY SCORECARD
          </p>
          <p className="mt-1 text-xs text-ink-80">
            Live AI synthesis of {moverName}&apos;s verified reviews, sub-ratings, and dispute
            resolution history.
          </p>
        </div>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => submit({})}
          className="mono inline-flex items-center gap-2 border border-hazard bg-hazard px-4 py-2 text-[11px] font-bold text-paper transition-colors hover:bg-ink hover:border-ink disabled:opacity-50"
        >
          <Sparkles className="size-3.5" />
          {isLoading
            ? 'STREAMING AI SCORECARD…'
            : object?.trustScore !== undefined
              ? 'REFRESH AI SCORECARD'
              : 'GENERATE AI TRUST SCORECARD'}
        </button>
      </div>

      {error ? (
        <p className="mono mt-3 text-[11px] text-hazard">
          Could not stream scorecard right now. Please try again.
        </p>
      ) : null}

      {object ? (
        <div className="mt-6 space-y-5 border-t border-ink pt-5">
          <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
            <div className="flex flex-col justify-between border border-ink bg-paper p-4">
              <p className="mono text-[10px] text-ink-80">MOVEUP TRUST INDEX</p>
              <p className="display mt-2 text-5xl text-hazard">{object.trustScore ?? '…'}/100</p>
              {object.tierBadge ? (
                <span className="mono mt-3 inline-block border border-ink bg-ink px-2 py-0.5 text-[10px] font-bold text-paper">
                  {TIER_LABELS[object.tierBadge] ?? object.tierBadge}
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 border border-ink bg-paper p-4 sm:grid-cols-2">
              {bars.map((bar) => (
                <div key={bar.label} className="space-y-1">
                  <div className="mono flex justify-between text-[10px]">
                    <span>{bar.label.toUpperCase()}</span>
                    <span className="font-bold">{bar.value ?? 0}%</span>
                  </div>
                  <div className="h-2 w-full border border-ink bg-ink/10">
                    <div
                      className="h-full bg-hazard transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, bar.value ?? 0))}%` }}
                    />
                  </div>
                </div>
              ))}
              {object.verdict ? (
                <p className="mt-2 border-t border-ink/20 pt-2 text-xs leading-relaxed text-ink sm:col-span-2">
                  {object.verdict}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {object.strengths && object.strengths.length > 0 ? (
              <div className="border border-ink bg-paper p-4">
                <p className="mono flex items-center gap-1.5 text-[10px] font-bold text-emerald-700">
                  <CheckCircle2 className="size-3.5" /> VERIFIED STRENGTHS
                </p>
                <ul className="mt-2 space-y-1.5 text-xs">
                  {object.strengths.map((s, idx) =>
                    s ? (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mono font-bold text-emerald-700">+</span>
                        <span>{s}</span>
                      </li>
                    ) : null,
                  )}
                </ul>
              </div>
            ) : null}

            {object.watchouts && object.watchouts.length > 0 ? (
              <div className="border border-ink bg-paper p-4">
                <p className="mono flex items-center gap-1.5 text-[10px] font-bold text-hazard">
                  <AlertTriangle className="size-3.5" /> BOOKING WATCHOUTS & TIPS
                </p>
                <ul className="mt-2 space-y-1.5 text-xs">
                  {object.watchouts.map((w, idx) =>
                    w ? (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mono font-bold text-hazard">!</span>
                        <span>{w}</span>
                      </li>
                    ) : null,
                  )}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

