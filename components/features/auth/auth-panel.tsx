'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

/**
 * Auth telemetry panel — the "device console" side of the split screen.
 * Looping status ticker via a repeating GSAP timeline; static under
 * prefers-reduced-motion.
 */
export function AuthPanel() {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!reduce) {
        gsap.from('[data-auth-panel-cell]', {
          yPercent: 120,
          autoAlpha: 0,
          duration: 0.9,
          stagger: 0.08,
          ease: 'power4.out',
        });
      }

      // Looping ticker wall
      const rows = rootRef.current?.querySelectorAll('[data-auth-tick]');
      if (rows && !reduce) {
        gsap.fromTo(
          rows,
          { opacity: 0.25 },
          {
            opacity: 1,
            duration: 1.4,
            stagger: { each: 0.35, yoyo: true, repeat: -1 },
            ease: 'none',
          },
        );
      }
    },
    { scope: rootRef },
  );

  const ticks = [
    'CONSOLE / TUNIS-NORD',
    'REGISTRY SYNC OK',
    'MOVER QUEUE: 237',
    'TOKEN: HS256 + 15M',
    'PAPER TRAIL: ON',
    'ZONE GRID: 11 SECTORS',
  ];

  return (
    <aside
      ref={rootRef}
      className="dotgrid relative hidden flex-col justify-between border-r border-ink bg-paper-soft p-10 lg:flex"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-ink/30 pb-6">
        <p data-auth-panel-cell className="mono text-sm font-bold">
          <span className="mr-2 inline-block size-2.5 bg-hazard align-middle" />
          MOVE<span className="text-hazard">UP</span>
        </p>
        <p data-auth-panel-cell className="mono text-[10px] text-ink-40">
          SECURE AREA
        </p>
      </div>

      <div>
        <h2 data-auth-panel-cell className="display max-w-[12ch] text-5xl">
          MOVING IS LOGISTICS.
        </h2>
        <p
          data-auth-panel-cell
          className="mono mt-6 max-w-[38ch] text-[11px] leading-relaxed text-ink-80"
        >
          {'// LOGISTICS DESERVES A PAPER TRAIL.'}
        </p>
      </div>

      <div className="space-y-2">
        {ticks.map((tick, index) => (
          <p
            key={tick}
            data-auth-tick
            className="mono flex items-center gap-3 text-[10px] text-ink-80"
          >
            <span className="inline-block size-1 bg-ink-40" />
            {tick}
            <span className="ml-auto text-ink-40">
              {'///'}
              {`0${index + 1}`}
            </span>
          </p>
        ))}
      </div>

      <p data-auth-panel-cell className="mono text-[10px] text-ink-40">
        © 2026 — REG TN-2026-0119 — REV 2.6
      </p>
    </aside>
  );
}
