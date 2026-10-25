'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { SectionHeading } from '@/components/shared/section-heading';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Coverage — Desire block.
 * Off-grid editorial: pinned title column left, image ledger scrolling right.
 * Images scale 0.8 → 1 on entry and darken/fade on exit.
 */
const CITIES = [
  { code: 'TUN', name: 'TUNIS', note: 'HQ — SAME-DAY DISPATCH', seed: 'moveup-tunis', rows: 2 },
  { code: 'SFA', name: 'SFAX', note: 'CITY + SUBURB RADIUS', seed: 'moveup-sfax', rows: 1 },
  { code: 'SOU', name: 'SOUSSE', note: 'COASTAL ROUTE', seed: 'moveup-sousse', rows: 1 },
  { code: 'BIZ', name: 'BIZERTE', note: 'NORTH SECTOR', seed: 'moveup-bizerte', rows: 2 },
  { code: 'NAB', name: 'NABEUL', note: 'CAPE ROUTE', seed: 'moveup-nabeul', rows: 1 },
  { code: 'KAI', name: 'KAIROUAN', note: 'CENTER SECTOR', seed: 'moveup-kairouan', rows: 1 },
];

export function Coverage() {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      gsap.matchMedia().add('(min-width: 768px)', () => {
        gsap.to('[data-coverage-list]', {
          yPercent: -8,
          ease: 'none',
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1,
          },
        });
      });

      gsap.utils.toArray<gsap.TweenTarget>('[data-coverage-card]').forEach((target) => {
        const card = target as Element;
        const image = card.querySelector('img');

        gsap.fromTo(
          card,
          { autoAlpha: 1, scale: 0.8 },
          {
            scale: 1,
            autoAlpha: 1,
            ease: 'power2.out',
            duration: 0.9,
            scrollTrigger: { trigger: card as Element, start: 'top 88%', once: true },
          },
        );

        if (image) {
          gsap.to(card, {
            autoAlpha: 0.2,
            ease: 'none',
            scrollTrigger: {
              trigger: card as Element,
              start: 'bottom 30%',
              end: 'bottom 5%',
              scrub: true,
            },
          });
        }
      });
    },
    { scope: rootRef },
  );

  return (
    <section id="coverage" ref={rootRef} className="border-b border-ink bg-paper">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 py-24 md:grid-cols-12 md:px-6 md:py-32">
        {/* Pinned title column */}
        <div className="md:col-span-4">
          <div className="md:sticky md:top-28">
            <SectionHeading index="03 —" title="[ COVERAGE ]" className="mb-8" />
            <p className="max-w-[34ch] text-sm leading-relaxed text-ink-80">
              Six operating centers, city rates, no distance guesswork. The estimator prices by
              sector — surface, rooms, floors, elevator and address distance are all recorded per
              request.
            </p>
            <p className="mono mt-6 text-[10px] text-hazard">V-02 ESTIMATOR — ROADMAP CH.9</p>
          </div>
        </div>

        {/* Scrolling ledger */}
        <div data-coverage-list className="md:col-span-8 md:pl-16">
          <div className="grid grid-cols-2 gap-px border border-ink bg-ink sm:grid-cols-3">
            {CITIES.map((city, index) => (
              <article
                key={city.code}
                data-coverage-card
                className={`group relative overflow-hidden bg-paper will-change-transform ${
                  city.rows === 2 ? 'row-span-2' : ''
                }`}
              >
                <div className={`relative ${city.rows === 2 ? 'h-full min-h-72' : 'h-40'}`}>
                  <img
                    src={`https://picsum.photos/seed/${city.seed}/700/1000`}
                    alt=""
                    className="absolute inset-0 size-full object-cover grayscale contrast-125 opacity-80 transition-all duration-700 group-hover:scale-105 group-hover:opacity-100"
                    loading="lazy"
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-ink bg-paper px-3 py-2">
                  <span className="mono text-[11px] font-bold">{city.name}</span>
                  <span className="mono text-[9px] text-hazard">
                    {city.code}/{`0${index + 1}`}
                  </span>
                </div>
                <span className="mono absolute left-2 top-2 bg-ink/80 px-1.5 py-0.5 text-[9px] text-paper">
                  {city.note}
                </span>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
