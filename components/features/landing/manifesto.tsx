'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Manifesto — Desire block.
 * Scrubbing text reveal: words sit at 0.1 opacity and resolve to 1.0
 * sequentially, tied to scroll position (scrub connected to ScrollTrigger).
 */
const PARAGRAPH =
  'We do not sell trucks. We run a registry. Every mover is verified, every quote is written, every status change is logged. When your boxes arrive, the record is what protects you — the addresses, the price, the photos, the signature. Moving is logistics. Logistics deserves a paper trail.';

export function Manifesto() {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        rootRef.current?.querySelectorAll('[data-word]').forEach((word) => {
          (word as HTMLElement).style.opacity = '1';
        });
        return;
      }

      gsap.to('[data-word]', {
        opacity: 1,
        stagger: 0.05,
        ease: 'none',
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top 75%',
          end: 'center 40%',
          scrub: 0.6,
        },
      });
    },
    { scope: rootRef },
  );

  return (
    <section ref={rootRef} className="border-b border-ink bg-ink text-paper">
      <div className="mx-auto max-w-5xl px-4 py-32 md:px-6 md:py-44">
        <p className="mono mb-8 text-[10px] text-hazard">[ OPERATING PRINCIPLE ]</p>
        <p className="display text-2xl leading-snug md:text-4xl md:leading-snug">
          {PARAGRAPH.split(' ').map((word, index) => (
            <span
              key={index}
              data-word
              className="inline-block opacity-10"
              style={{ marginRight: '0.28em' }}
            >
              {word}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
