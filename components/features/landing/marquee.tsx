'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

/** Kinetic marquee — seamless belt via a duplicated track and a 50% xPercent wrap. */
export function Marquee({ words }: { words: string[] }) {
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const track = trackRef.current;
      if (!track || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const tween = gsap.to(track, {
        xPercent: -50,
        duration: 26,
        ease: 'none',
        repeat: -1,
        modifiers: { xPercent: (x) => `${parseFloat(x) % 50}` },
      });
      return () => tween.kill();
    },
    { scope: rootRef, dependencies: [words.join('|')], revertOnUpdate: true },
  );

  return (
    <section
      ref={rootRef}
      className="overflow-hidden border-b-2 border-ink bg-ink text-paper"
      aria-hidden
    >
      <div ref={trackRef} className="marquee-track flex w-max items-center py-3">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex w-max items-center">
            {words.map((word, index) => (
              <span
                key={`${copy}-${index}`}
                className="mono mx-6 flex items-center text-xs md:text-sm"
              >
                <span className="mr-6 inline-block size-1.5 bg-hazard" />
                {word}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
