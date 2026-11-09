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
 * Manifesto — Desire. Words render fully legible; only when motion is allowed
 * does the script dim them and let the scroll resolve them one by one.
 */
export function Manifesto({ t }: { t: LandingMessages['manifesto'] }) {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.fromTo(
        '[data-word]',
        { opacity: 0.12 },
        {
          opacity: 1,
          stagger: 0.05,
          ease: 'none',
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top 70%',
            end: 'center 45%',
            scrub: 0.6,
          },
        },
      );
    },
    { scope: rootRef, dependencies: [t.text], revertOnUpdate: true },
  );

  return (
    <section ref={rootRef} className="on-ink border-b border-ink bg-ink text-paper">
      <div className="mx-auto max-w-5xl px-4 py-32 md:px-6 md:py-44">
        <p className="mono mb-8 text-[11px] text-hazard-glow">{t.kicker}</p>
        <p className="display text-[clamp(1.6rem,3.6vw,2.6rem)] leading-[1.15] tracking-[-0.02em]">
          {t.text.split(' ').map((word, index) => (
            <span key={index} data-word className="inline-block" style={{ marginRight: '0.28em' }}>
              {word}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
