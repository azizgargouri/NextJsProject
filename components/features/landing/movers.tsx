'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { MagneticLink } from '@/components/shared/magnetic-button';
import type { LandingMessages } from '@/lib/i18n/landing';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/** Movers — the crew-side pitch, on ink, with its own sign-up path. */
export function Movers({ t }: { t: LandingMessages['movers'] }) {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.from('[data-movers-reveal]', {
        y: 36,
        autoAlpha: 0,
        duration: 1,
        ease: 'expo.out',
        stagger: 0.08,
        scrollTrigger: { trigger: rootRef.current, start: 'top 75%', once: true },
      });
    },
    { scope: rootRef },
  );

  return (
    <section
      id="become-mover"
      tabIndex={-1}
      ref={rootRef}
      aria-labelledby="movers-title"
      className="on-ink scroll-mt-14 border-b border-ink bg-ink text-paper outline-none"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-24 md:px-6 md:py-32">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p data-movers-reveal className="mono text-[11px] text-hazard-glow">
              {t.kicker}
            </p>
            <h2
              id="movers-title"
              data-movers-reveal
              className="display mt-4 text-[clamp(2.25rem,5vw,4.25rem)]"
            >
              {t.title}
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p data-movers-reveal className="max-w-[46ch] text-base leading-relaxed text-paper/80">
              {t.body}
            </p>
            <div data-movers-reveal className="mt-8">
              <MagneticLink
                href="/sign-up?role=MOVER"
                size="lg"
                className="bg-paper text-ink hover:bg-hazard hover:text-white"
              >
                {t.cta}
              </MagneticLink>
            </div>
          </div>
        </div>

        <ul
          data-movers-reveal
          className="mt-16 grid grid-cols-1 gap-px border border-paper/30 bg-paper/30 md:grid-cols-3"
        >
          {t.cells.map((cell) => (
            <li key={cell.code} className="bg-ink p-6 md:p-8">
              <p className="mono text-[11px] text-hazard-glow">[{cell.code}]</p>
              <h3 className="display mt-2 text-2xl">{cell.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-paper/75">{cell.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
