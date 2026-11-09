'use client';

import { useRef } from 'react';
import Link from 'next/link';
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
    'QUOTES IN WRITING',
    'TOKEN: HS256 + 15M',
    'PAPER TRAIL: ON',
    'TUNIS · SFAX · SOUSSE',
  ];

  return (
    <aside
      ref={rootRef}
      className="dotgrid relative hidden flex-col justify-between border-r border-ink bg-paper-soft p-10 lg:flex"
    >
      <div className="flex items-center justify-between border-b border-ink/30 pb-6">
        <Link
          href="/"
          aria-label="MoveUp home"
          data-auth-panel-cell
          className="mono text-sm font-bold hover:text-hazard-ink"
        >
          <span className="mr-2 inline-block size-2.5 bg-hazard align-middle" aria-hidden />
          MOVE<span className="text-hazard-ink">UP</span>
        </Link>
        <p data-auth-panel-cell aria-hidden className="mono text-[11px] text-ink-60">
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

      <div className="space-y-2" aria-hidden>
        {ticks.map((tick, index) => (
          <p
            key={tick}
            data-auth-tick
            className="mono flex items-center gap-3 text-[11px] text-ink-80"
          >
            <span className="inline-block size-1 bg-ink-40" />
            {tick}
            <span className="ml-auto text-ink-60">
              {'///'}
              {`0${index + 1}`}
            </span>
          </p>
        ))}
      </div>

      <p data-auth-panel-cell className="mono text-[11px] text-ink-60">
        © {new Date().getFullYear()} MOVEUP · TUNIS / SFAX / SOUSSE
      </p>
    </aside>
  );
}
