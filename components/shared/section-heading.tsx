'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { cn } from '@/lib/utils';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Bracket heading: "01 [ WHAT WE MOVE ]" plus a hairline rule that draws in.
 * The brackets are decorative and glued to the first and last word, so a
 * narrow column can never leave a bracket alone on its own line.
 */
export function SectionHeading({
  index,
  title,
  id,
  className,
  tone = 'paper',
  size = 'wide',
}: {
  index: string;
  title: string;
  id?: string;
  className?: string;
  tone?: 'paper' | 'ink';
  /** `column` for headings set in a narrow sidebar column. */
  size?: 'wide' | 'column';
}) {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const trigger = { trigger: rootRef.current, start: 'top 85%', once: true };
      gsap.from('[data-heading-line]', {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 1.2,
        ease: 'expo.out',
        scrollTrigger: trigger,
      });
      gsap.from('[data-heading-text]', {
        yPercent: 100,
        duration: 1,
        ease: 'expo.out',
        stagger: 0.06,
        scrollTrigger: trigger,
      });
    },
    { scope: rootRef },
  );

  const words = title.split(/\s+/).filter(Boolean);

  return (
    <header ref={rootRef} className={className}>
      <div className="mb-3 flex items-baseline gap-4">
        <span
          className={cn(
            'mono shrink-0 text-[11px]',
            tone === 'ink' ? 'text-hazard-glow' : 'text-hazard-ink',
          )}
        >
          {index}
        </span>
        <h2
          id={id}
          className={cn(
            'display -mt-[0.2em] overflow-hidden pb-[0.04em] pt-[0.2em]',
            size === 'column'
              ? 'text-[clamp(1.75rem,2.4vw,2.25rem)]'
              : 'text-[clamp(2.25rem,5.5vw,4rem)]',
          )}
        >
          <span data-heading-text className="block">
            {words.map((word, i) => (
              <span key={i}>
                <span className="whitespace-nowrap">
                  {i === 0 ? <span aria-hidden>[&nbsp;</span> : null}
                  {word}
                  {i === words.length - 1 ? <span aria-hidden>&nbsp;]</span> : null}
                </span>
                {i < words.length - 1 ? ' ' : null}
              </span>
            ))}
          </span>
        </h2>
      </div>
      <div
        data-heading-line
        className={cn('h-px w-full', tone === 'ink' ? 'bg-paper/40' : 'bg-ink')}
      />
    </header>
  );
}
