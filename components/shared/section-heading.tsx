'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/** Functional bracket heading: "[ WHAT WE MOVE ]" — number + title + hairline rule that draws in. */
export function SectionHeading({
  index,
  title,
  className,
}: {
  index: string;
  title: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      gsap.from('[data-heading-line]', {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 1,
        scrollTrigger: { trigger: rootRef.current, start: 'top 85%', once: true },
      });

      gsap.from('[data-heading-text]', {
        y: 24,
        autoAlpha: 0,
        duration: 0.8,
        stagger: 0.08,
        scrollTrigger: { trigger: rootRef.current, start: 'top 85%', once: true },
      });
    },
    { scope: rootRef },
  );

  return (
    <header ref={rootRef} className={className}>
      <div className="relative mb-2 flex items-baseline gap-4">
        <span data-heading-text className="mono text-[11px] text-hazard">
          {index}
        </span>
        <h2 data-heading-text className="display text-4xl md:text-6xl">
          {title}
        </h2>
      </div>
      <div data-heading-line className="h-px w-full bg-ink" />
    </header>
  );
}
