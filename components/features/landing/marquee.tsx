'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const WORDS = [
  'PACKING',
  'LOADING',
  'IN TRANSIT',
  'DELIVERY',
  'DISASSEMBLY',
  'REASSEMBLY',
  'TRACKED',
];

/** Kinetic marquee — seamless infinite belt via duplicated track + xPercent wrap. */
export function Marquee() {
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const track = trackRef.current;
      if (!track || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const width = track.scrollWidth / 2;
      const tween = gsap.to(track, {
        xPercent: -50,
        duration: 22,
        ease: 'none',
        repeat: -1,
        modifiers: {
          xPercent: (x) => `${x % 50}`,
        },
      });

      // Original intent: keep a handle for scroll-velocity speed-up.
      void width;

      return () => tween.kill();
    },
    { scope: rootRef },
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
            {WORDS.map((word, index) => (
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
