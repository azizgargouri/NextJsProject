'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import type { LandingMessages } from '@/lib/i18n/landing';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Commitments ledger — Interest. Four rules the product enforces, set as
 * stamped words instead of invented statistics.
 */
export function Commitments({ t }: { t: LandingMessages['commitments'] }) {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.from('[data-stamp]', {
        yPercent: 100,
        duration: 1,
        ease: 'expo.out',
        stagger: 0.12,
        scrollTrigger: { trigger: rootRef.current, start: 'top 80%', once: true },
      });
      gsap.from('[data-stamp-body]', {
        autoAlpha: 0,
        y: 12,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.12,
        delay: 0.25,
        scrollTrigger: { trigger: rootRef.current, start: 'top 80%', once: true },
      });
    },
    { scope: rootRef },
  );

  return (
    <section
      ref={rootRef}
      aria-labelledby="commitments-title"
      className="border-b border-ink bg-paper"
    >
      <div className="mx-auto w-full max-w-7xl">
        <h2
          id="commitments-title"
          className="mono border-b border-ink px-4 py-3 text-[11px] text-hazard-ink md:px-8"
        >
          {t.kicker}
        </h2>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {t.items.map((item, index) => (
            <li
              key={item.word}
              className="border-ink px-4 py-10 md:px-8 md:py-12 [&:not(:last-child)]:border-b sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:[&:not(:last-child)]:border-r"
            >
              <p className="mono text-[11px] text-ink-60">{`0${index + 1}`}</p>
              <p className="mt-1 overflow-hidden pt-[0.25em]">
                <span
                  data-stamp
                  className="display block text-[clamp(1.9rem,2.6vw,2.4rem)] text-ink"
                >
                  {item.word}
                </span>
              </p>
              <p data-stamp-body className="mt-4 max-w-[30ch] text-sm leading-relaxed text-ink-80">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
